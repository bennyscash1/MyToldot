/**
 * /api/v1/trees/[treeId]/about
 *
 * GET   → fetch heritage description and main surnames for the tree (VIEWER+)
 * PATCH → partial update of about_text and/or main_surnames        (EDITOR+)
 *
 * Sibling of /api/v1/trees/[treeId]/* — kept under the v1 namespace for
 * consistency with the rest of the REST surface (see docs/REST_API_REFERENCE.md).
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import type { TreeAboutDto } from '@/types/api';

const ABOUT_SELECT = {
  id: true,
  about_text: true,
  main_surnames: true,
} as const;

type RouteContext = { params: Promise<{ treeId: string }> };

// Reasonable limits to keep the column small and the UI snappy.
const ABOUT_TEXT_MAX = 10_000;
const SURNAME_MAX = 100;
const MAIN_SURNAMES_MAX_COUNT = 50;

/**
 * Validation for PATCH bodies.
 *
 * Both fields are optional independently:
 *   - `about_text: null` explicitly clears the description.
 *   - `main_surnames` is normalized: trimmed, empties dropped, deduped.
 */
const updateAboutSchema = z
  .object({
    about_text: z
      .string()
      .max(ABOUT_TEXT_MAX, `about_text must be ${ABOUT_TEXT_MAX} characters or fewer`)
      .nullable()
      .optional(),
    main_surnames: z
      .array(
        z
          .string()
          .max(SURNAME_MAX, `surname must be ${SURNAME_MAX} characters or fewer`),
      )
      .max(MAIN_SURNAMES_MAX_COUNT, `main_surnames may contain at most ${MAIN_SURNAMES_MAX_COUNT} entries`)
      .optional(),
  })
  .strict();

async function findAboutOrThrow(treeId: string) {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: ABOUT_SELECT,
  });
  if (!tree) throw Errors.notFound('Tree');
  return tree;
}

// ─────────────────────────────────────────────
// GET /api/v1/trees/:treeId/about
// ─────────────────────────────────────────────
export const GET = withErrorHandler(async (_req: NextRequest, ctx: RouteContext) => {
  const { treeId } = await ctx.params;
  await requireTreeRole(treeId, 'VIEWER');

  const tree = await findAboutOrThrow(treeId);
  return ok<TreeAboutDto>(tree);
});

// ─────────────────────────────────────────────
// PATCH /api/v1/trees/:treeId/about
// ─────────────────────────────────────────────
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { treeId } = await ctx.params;
  await requireTreeRole(treeId, 'EDITOR');

  // Ensure the tree exists before validating the body so 404 wins over 422.
  await findAboutOrThrow(treeId);

  const json = await req.json().catch(() => {
    throw Errors.badRequest('Request body must be valid JSON');
  });

  const parsed = updateAboutSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw Errors.unprocessable(message);
  }

  const body = parsed.data;

  // Build the update payload — only include fields that were actually provided.
  const data: { about_text?: string | null; main_surnames?: string[] } = {};

  if (body.about_text !== undefined) {
    if (body.about_text === null) {
      data.about_text = null;
    } else {
      const trimmed = body.about_text.trim();
      data.about_text = trimmed.length === 0 ? null : trimmed;
    }
  }

  if (body.main_surnames !== undefined) {
    // Trim, drop empties, dedupe (case-insensitive) while preserving caller order.
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of body.main_surnames) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) continue;
      const key = trimmed.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(trimmed);
    }
    data.main_surnames = normalized;
  }

  // No-op PATCH — return current state instead of an empty update.
  if (Object.keys(data).length === 0) {
    const current = await findAboutOrThrow(treeId);
    return ok<TreeAboutDto>(current);
  }

  const updated = await prisma.tree.update({
    where: { id: treeId },
    data,
    select: ABOUT_SELECT,
  });

  return ok<TreeAboutDto>(updated);
});
