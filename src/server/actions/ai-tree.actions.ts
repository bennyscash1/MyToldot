'use server';

import { revalidatePath } from 'next/cache';

import { ZodError } from 'zod';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import { ApiError, Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import {
  generateStructuredJson,
  geminiContentsUserCharCount,
  structuredJsonTimeoutMs,
  type GeminiContent,
} from '@/server/lib/gemini';
import { generateGroundedAiTreePlan } from '@/server/lib/ai-tree-builder/gemini-grounded';
import { AI_TREE_BUILDER_SYSTEM_PROMPT } from '@/server/lib/ai-tree-builder/prompt';
import {
  AiTreePlanSchema,
  type AiTreePlan,
} from '@/server/lib/ai-tree-builder/schema';
import { reconcileAiTreePlan } from '@/server/lib/ai-tree-builder/reconcile';
import {
  createPersonsAndRelationshipsInTree,
  type AiBatchGender,
  type AiBatchPersonInput,
  type AiBatchRelationshipInput,
} from '@/server/services/tree.service';
import { prisma } from '@/lib/prisma';

export interface PlanFamilyResult {
  plan: AiTreePlan;
  /** Updated conversation history to send back on the next refinement turn. */
  contents: GeminiContent[];
}

export interface PlanFamilyFromTextOptions {
  /** When true, Gemini may use google_search to enrich from public sources. Default false. */
  searchKnowledgeBases?: boolean;
}

/**
 * Call Gemini with the tree-builder system prompt and either the initial user
 * text or a refinement turn. Returns the parsed+reconciled plan plus the
 * updated `contents` array (caller passes it back verbatim on next turn).
 *
 * The action is scoped to EDITORs of an empty tree — we reject up-front if
 * the tree already has people so we don't waste a Gemini call.
 */
export async function planFamilyFromTextAction(
  treeId: string,
  userText: string,
  priorContents: GeminiContent[] = [],
  options: PlanFamilyFromTextOptions = {},
): Promise<ActionResult<PlanFamilyResult>> {
  const searchKnowledgeBases = options.searchKnowledgeBases === true;
  const isRefinement = priorContents.length > 0;
  return withAction(async () => {
    try {
      const id = CuidSchema.parse(treeId);
      await requireTreeRole(id, 'EDITOR');

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

      // Reject the call if the tree already has people — the AI builder is
      // one-shot, empty-state-only. Doing this here also prevents wasting tokens.
      const existingCount = await prisma.person.count({ where: { tree_id: id } });
      if (existingCount > 0) {
        throw Errors.conflict('AI tree builder only supports empty trees');
      }

      const nextContents: GeminiContent[] = [
        ...priorContents,
        { role: 'user', parts: [{ text: trimmed }] },
      ];

      const { parsed, text, finishReason } = searchKnowledgeBases
        ? await generateGroundedAiTreePlan({ contents: nextContents })
        : await generateStructuredJson({
            systemInstruction: AI_TREE_BUILDER_SYSTEM_PROMPT,
            contents: nextContents,
            timeoutMs: structuredJsonTimeoutMs(geminiContentsUserCharCount(nextContents)),
          });

      if (!parsed) {
        // Translate the finish reason into something the user can act on,
        // instead of an opaque failure. MAX_TOKENS is the realistic ceiling for
        // very large families regenerated whole on a refinement turn.
        if (finishReason === 'MAX_TOKENS') {
          throw Errors.unprocessable(
            isRefinement
              ? 'The updated tree got too large to generate in one pass. Try a smaller correction, or apply what you have and edit the rest manually.'
              : 'This description is too large to process at once. Try shortening it or splitting the family into branches.',
          );
        }
        if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
          throw Errors.unprocessable('The AI could not process this text. Please rephrase and try again.');
        }
        console.error('[ai-tree:plan] empty/unparseable AI response', {
          isRefinement,
          searchKnowledgeBases,
          finishReason,
          textLen: text.length,
        });
        throw Errors.internal('The AI response could not be read. Please try again.');
      }

      const validated = AiTreePlanSchema.parse(parsed);
      const reconciled = reconcileAiTreePlan(validated);

      // Append the model's turn so the next refinement call carries history.
      const conversation: GeminiContent[] = [
        ...nextContents,
        { role: 'model', parts: [{ text }] },
      ];

      return { plan: reconciled, contents: conversation };
    } catch (err) {
      // ApiError → its own message; ZodError → withAction maps to "Validation
      // failed" with field errors. Anything else is a genuinely unexpected
      // throw (e.g. a Prisma fault) — log the real cause with a tag for
      // diagnosis and surface a specific, retryable message rather than the
      // opaque "An unexpected error occurred".
      if (err instanceof ApiError || err instanceof ZodError) throw err;
      console.error('[ai-tree:plan] unexpected error', {
        isRefinement,
        searchKnowledgeBases,
        turns: priorContents.length + 1,
      }, err);
      throw Errors.internal('Something went wrong while building your tree. Please try again.');
    }
  });
}

export interface BuildPlanResult {
  treeShortCode: string;
  personCount: number;
  relationshipCount: number;
  rootPersonId: string | null;
}

/**
 * Apply a reconciled plan to the (empty) tree. Validates the plan once more
 * server-side so a malicious client can't bypass `reconcile`/`schema`.
 */
export async function buildTreeFromAiPlanAction(
  treeId: string,
  rawPlan: unknown,
): Promise<ActionResult<BuildPlanResult>> {
  return withAction(async () => {
    const t0 = Date.now();
    try {
      const id = CuidSchema.parse(treeId);
      await requireTreeRole(id, 'EDITOR');

      const validated = AiTreePlanSchema.parse(rawPlan);
      const plan = reconcileAiTreePlan(validated);
      console.log(
        `[ai-tree:build] action invoked treeId=${id} planPersons=${plan.persons.length} planRels=${plan.relationships.length} (+${Date.now() - t0}ms)`,
      );

      if (plan.persons.length === 0) {
        throw Errors.badRequest('Plan contains no persons to create.');
      }

      const persons: AiBatchPersonInput[] = plan.persons.map((p) => ({
        local_id: p.local_id,
        first_name: p.first_name && p.first_name.length > 0 ? p.first_name : p.first_name_he,
        last_name: p.last_name && p.last_name.length > 0 ? p.last_name : null,
        first_name_he: p.first_name_he,
        last_name_he: p.last_name_he,
        gender: p.gender as AiBatchGender,
        birth_year: p.birth_year ?? null,
        death_year: p.death_year ?? null,
        is_deceased: p.is_deceased,
        bio: p.notes && p.notes.length > 0 ? p.notes : null,
      }));

      const relationships: AiBatchRelationshipInput[] = plan.relationships.map((r) => ({
        type: r.type,
        from_local_id: r.from_local_id,
        to_local_id: r.to_local_id,
      }));

      console.log(`[ai-tree:build] validation passed; calling service (+${Date.now() - t0}ms)`);
      const result = await createPersonsAndRelationshipsInTree({
        treeId: id,
        persons,
        relationships,
        rootLocalId: plan.suggested_root_local_id,
        permissive: true,
      });
      console.log(
        `[ai-tree:build] service returned persons=${result.personCount} rels=${result.relationshipCount} root=${result.rootPersonId} (+${Date.now() - t0}ms)`,
      );

      const tree = await prisma.tree.findUnique({
        where: { id },
        select: { shortCode: true },
      });

      revalidatePath('/[locale]/tree', 'page');
      console.log(`[ai-tree:build] revalidatePath done; returning success (+${Date.now() - t0}ms)`);

      return {
        treeShortCode: tree?.shortCode ?? '',
        personCount: result.personCount,
        relationshipCount: result.relationshipCount,
        rootPersonId: result.rootPersonId,
      };
    } catch (err) {
      // Surface the REAL cause for diagnosis. ApiError/ZodError keep their
      // proper classification; anything else (e.g. a Prisma P2028 transaction
      // timeout) is logged with full detail before re-throwing.
      const e = err as { name?: string; code?: string; message?: string; stack?: string };
      console.error('[ai-tree:build] THREW', {
        name: e?.name,
        code: e?.code,
        isApiError: err instanceof ApiError,
        isZodError: err instanceof ZodError,
        message: e?.message,
        elapsedMs: Date.now() - t0,
      });
      console.error('[ai-tree:build] STACK', e?.stack);
      throw err;
    }
  });
}
