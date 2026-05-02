import { NextRequest } from 'next/server';
import { ok, withErrorHandler } from '@/lib/api/response';
import { resolveTreePageDataBySlug } from '@/server/services/tree.service';

type RouteContext = { params: Promise<{ shortCode: string }> };

export const GET = withErrorHandler(async (_req: NextRequest, ctx: RouteContext) => {
  const { shortCode } = await ctx.params;
  const data = await resolveTreePageDataBySlug(shortCode);
  return ok(data);
});
