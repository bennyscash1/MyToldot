import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ok, withErrorHandler } from '@/lib/api/response';
import { addParentInTree, AddParentSchema, resolveTreeIdFromSlug } from '@/server/services/tree.service';

type RouteContext = { params: Promise<{ locale: string; slug: string }> };

export const POST = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { locale, slug } = await ctx.params;
  const treeId = await resolveTreeIdFromSlug(slug);
  const json = await req.json();
  const body = AddParentSchema.parse({ ...json, treeId });
  const result = await addParentInTree(body);
  revalidatePath(`/${locale}/tree/${slug}`, 'page');
  return ok(result);
});
