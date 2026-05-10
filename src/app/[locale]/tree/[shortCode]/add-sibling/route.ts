import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ok, withErrorHandler } from '@/lib/api/response';
import {
  addSiblingInTree,
  AddSiblingSchema,
  resolveTreeIdFromRouteParam,
} from '@/server/services/tree.service';

type RouteContext = { params: Promise<{ locale: string; shortCode: string }> };

export const POST = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { locale, shortCode } = await ctx.params;
  const treeId = await resolveTreeIdFromRouteParam(shortCode);
  const json = await req.json();
  const body = AddSiblingSchema.parse({ ...json, treeId });
  const result = await addSiblingInTree(body);
  revalidatePath(`/${locale}/tree/${shortCode}`, 'page');
  return ok(result);
});
