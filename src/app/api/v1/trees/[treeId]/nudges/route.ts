/**
 * /api/v1/trees/[treeId]/nudges
 *
 * GET → list of up to 20 "fill in the gap" nudges for this tree.
 *       EDITOR+ only. Computes missing-data heuristics over Person rows.
 */

import { NextRequest } from 'next/server';

import { ok, withErrorHandler } from '@/lib/api/response';
import { requireTreeRole } from '@/lib/api/auth';
import { computeNudgesForTree } from '@/server/services/nudges.service';
import type { NudgesResponse } from '@/features/nudges/lib/nudge-types';

type RouteContext = { params: Promise<{ treeId: string }> };

export const GET = withErrorHandler(async (_req: NextRequest, ctx: RouteContext) => {
  const { treeId } = await ctx.params;
  await requireTreeRole(treeId, 'EDITOR');
  const nudges = await computeNudgesForTree(treeId);
  return ok<NudgesResponse>({ nudges });
});
