'use server';

import { revalidatePath } from 'next/cache';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import { Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import { generateStructuredJson, type GeminiContent } from '@/server/lib/gemini';
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
): Promise<ActionResult<PlanFamilyResult>> {
  return withAction(async () => {
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

    const { parsed, text } = await generateStructuredJson({
      systemInstruction: AI_TREE_BUILDER_SYSTEM_PROMPT,
      contents: nextContents,
    });

    if (!parsed) {
      throw Errors.internal('AI returned an unparseable response. Please try again.');
    }

    const validated = AiTreePlanSchema.parse(parsed);
    const reconciled = reconcileAiTreePlan(validated);

    // Append the model's turn so the next refinement call carries history.
    const conversation: GeminiContent[] = [
      ...nextContents,
      { role: 'model', parts: [{ text }] },
    ];

    return { plan: reconciled, contents: conversation };
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
    const id = CuidSchema.parse(treeId);
    await requireTreeRole(id, 'EDITOR');

    const validated = AiTreePlanSchema.parse(rawPlan);
    const plan = reconcileAiTreePlan(validated);

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

    const result = await createPersonsAndRelationshipsInTree({
      treeId: id,
      persons,
      relationships,
      rootLocalId: plan.suggested_root_local_id,
      permissive: true,
    });

    const tree = await prisma.tree.findUnique({
      where: { id },
      select: { shortCode: true },
    });

    revalidatePath('/[locale]/tree', 'page');

    return {
      treeShortCode: tree?.shortCode ?? '',
      personCount: result.personCount,
      relationshipCount: result.relationshipCount,
      rootPersonId: result.rootPersonId,
    };
  });
}
