'use server';

import { revalidatePath } from 'next/cache';
import { TreeMemberRole } from '@prisma/client';
import { ZodError } from 'zod';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import { ApiError, Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import { prisma } from '@/lib/prisma';
import { applyFamilyMergeProposal } from '@/server/lib/ai-family-merge/apply';
import { buildExistingFamilySnapshot } from '@/server/lib/ai-family-merge/existing-family';
import { generateGroundedFamilyMerge } from '@/server/lib/ai-family-merge/gemini-grounded';
import {
  AI_FAMILY_MERGE_SYSTEM_PROMPT,
  buildFamilyMergeUserPayload,
} from '@/server/lib/ai-family-merge/prompt';
import { reconcileMergeProposal } from '@/server/lib/ai-family-merge/reconcile';
import {
  CommitFamilyMergeSchema,
  type FamilyMergeProposal,
} from '@/server/lib/ai-family-merge/schema';
import {
  generateStructuredJson,
  geminiContentsUserCharCount,
  structuredJsonTimeoutMs,
} from '@/server/lib/gemini';
import type { AddedRelativeDto } from '@/server/services/tree.service';
import type { TreePersonSummary, TreeRelationshipSummary } from '@/server/lib/family-discovery/summarize-tree';

export interface PlanFamilyMergeOptions {
  searchKnowledgeBases?: boolean;
}

export interface PlanFamilyMergeResult {
  proposal: FamilyMergeProposal;
  existingFamily: ReturnType<typeof buildExistingFamilySnapshot>['members'];
}

export interface CommitFamilyMergeResult {
  applied: AddedRelativeDto[];
  skipped: { tempId: string; reason: string }[];
  needsResolution: FamilyMergeProposal['ambiguousMatches'];
}

async function loadTreeForMerge(treeId: string): Promise<{
  persons: TreePersonSummary[];
  relationships: TreeRelationshipSummary[];
}> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: {
      persons: {
        select: {
          id: true,
          first_name_he: true,
          last_name_he: true,
          maiden_name: true,
          first_name: true,
          last_name: true,
          gender: true,
          birth_date: true,
          death_date: true,
          birth_place: true,
        },
      },
      relationships: {
        select: {
          id: true,
          relationship_type: true,
          person1_id: true,
          person2_id: true,
        },
      },
    },
  });
  if (!tree) throw Errors.notFound('Tree');
  return { persons: tree.persons, relationships: tree.relationships };
}

export async function planFamilyMergeFromTextAction(
  treeId: string,
  userText: string,
  options: PlanFamilyMergeOptions = {},
): Promise<ActionResult<PlanFamilyMergeResult>> {
  const searchKnowledgeBases = options.searchKnowledgeBases === true;
  return withAction(async () => {
    try {
      const id = CuidSchema.parse(treeId);
      await requireTreeRole(id, TreeMemberRole.EDITOR);

      if (!process.env.GEMINI_API_KEY) {
        throw Errors.internal('GEMINI_API_KEY is not configured');
      }

      const trimmed = userText.trim();
      if (trimmed.length < 5) {
        throw Errors.badRequest('Please describe at least one family member.');
      }
      if (trimmed.length > 8000) {
        throw Errors.badRequest('Input too long (max 8000 characters).');
      }

      const existingCount = await prisma.person.count({ where: { tree_id: id } });
      if (existingCount === 0) {
        throw Errors.conflict('Use the empty-tree AI builder when the tree has no people yet');
      }

      const { persons, relationships } = await loadTreeForMerge(id);
      const { members, truncated } = buildExistingFamilySnapshot(persons, relationships);

      const userPayload = buildFamilyMergeUserPayload({
        userText: trimmed,
        searchKnowledgeBases,
        existingFamily: members,
        truncatedExisting: truncated,
      });

      const { parsed, finishReason } = searchKnowledgeBases
        ? await generateGroundedFamilyMerge(userPayload)
        : await generateStructuredJson({
            systemInstruction: AI_FAMILY_MERGE_SYSTEM_PROMPT,
            contents: [{ role: 'user', parts: [{ text: userPayload }] }],
            timeoutMs: structuredJsonTimeoutMs(
              geminiContentsUserCharCount([{ role: 'user', parts: [{ text: userPayload }] }]),
            ),
          });

      if (!parsed) {
        if (finishReason === 'MAX_TOKENS') {
          throw Errors.unprocessable(
            'This description is too large to process at once. Try a shorter passage or fewer people.',
          );
        }
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          throw Errors.unprocessable('The AI could not process this text. Please rephrase and try again.');
        }
        throw Errors.internal('The AI response could not be read. Please try again.');
      }

      const { proposal } = reconcileMergeProposal(parsed, members);

      return { proposal, existingFamily: members };
    } catch (err) {
      if (err instanceof ApiError || err instanceof ZodError) throw err;
      console.error('[ai-family-merge:plan] unexpected error', { searchKnowledgeBases }, err);
      throw Errors.internal('Something went wrong while planning your additions. Please try again.');
    }
  });
}

export async function commitFamilyMergeProposalAction(
  treeId: string,
  proposal: FamilyMergeProposal,
  resolvedAmbiguities: Record<string, string> = {},
  skipAmbiguous = false,
): Promise<ActionResult<CommitFamilyMergeResult>> {
  return withAction(async () => {
    const validated = CommitFamilyMergeSchema.parse({
      treeId,
      proposal,
      resolvedAmbiguities,
      skipAmbiguous,
    });
    const id = validated.treeId;
    await requireTreeRole(id, TreeMemberRole.EDITOR);

    const { persons, relationships } = await loadTreeForMerge(id);
    const { members } = buildExistingFamilySnapshot(persons, relationships);
    const existingIds = new Set(members.map((m) => m.id));

    const { proposal: reconciled } = reconcileMergeProposal(validated.proposal, members);

    const result = await applyFamilyMergeProposal({
      treeId: id,
      proposal: reconciled,
      resolvedAmbiguities: validated.resolvedAmbiguities,
      skipAmbiguous: validated.skipAmbiguous,
      existingIds,
    });

    if (result.needsResolution.length > 0) {
      throw Errors.unprocessable(
        'Resolve ambiguous matches before applying, or choose to skip ambiguous additions.',
      );
    }

    revalidatePath('/[locale]/tree', 'page');

    return {
      applied: result.applied,
      skipped: result.skipped,
      needsResolution: result.needsResolution,
    };
  });
}
