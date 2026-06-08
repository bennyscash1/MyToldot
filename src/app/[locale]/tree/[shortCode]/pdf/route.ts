import { NextRequest, NextResponse } from 'next/server';

import { requireTreeRole } from '@/lib/api/auth';
import { withErrorHandler } from '@/lib/api/response';
import { getSiteOrigin } from '@/lib/site-url';
import { generateTreePdf } from '@/server/lib/pdf/generate';
import { decodePlan } from '@/server/lib/pdf/resolve-poster-data';
import { planTreeLayout } from '@/server/lib/pdf/plan';
import { buildTreeSummary, resolveHeadId } from '@/server/lib/pdf/summarize';
import { getBaseStyleId } from '@/server/lib/pdf/style-tokens';
import { resolveTreeIdFromRouteParam, resolveTreePageDataBySlug } from '@/server/services/tree.service';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ locale: string; shortCode: string }> };

export const GET = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { locale, shortCode } = await ctx.params;
  const treeId = await resolveTreeIdFromRouteParam(shortCode);
  await requireTreeRole(treeId, 'VIEWER');

  const url = new URL(req.url);
  const variantId = url.searchParams.get('styleId');
  if (!variantId) {
    return NextResponse.json({ error: { message: 'styleId is required' } }, { status: 400 });
  }

  const planRaw = url.searchParams.get('plan') ?? undefined;
  let plan = decodePlan(planRaw);

  if (!plan) {
    const treeData = await resolveTreePageDataBySlug(shortCode);
    const headId = resolveHeadId(treeData.initialPersons, treeData.rootPersonId);
    const summary = buildTreeSummary(
      treeData.initialPersons,
      treeData.initialRelationships,
      headId,
    );
    plan = await planTreeLayout(summary, getBaseStyleId(variantId));
  }

  const baseUrl = await getSiteOrigin();
  const pdf = await generateTreePdf({
    treeId,
    shortCode,
    locale,
    styleId: variantId,
    plan,
    baseUrl,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="toldotay-${shortCode}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});
