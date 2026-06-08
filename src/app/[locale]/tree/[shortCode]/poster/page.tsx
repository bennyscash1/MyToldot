import { redirect } from 'next/navigation';

import { getCurrentUserTreeRole } from '@/lib/api/auth';
import { PosterDesignerClient } from '@/features/family-tree/components/pdf/PosterDesignerClient';
import { generatePosterSession } from '@/server/lib/pdf/generate-poster-session';
import { getPdfRenderSecret } from '@/server/lib/pdf/pdf-render-auth';
import { DEFAULT_STYLE_ID } from '@/server/lib/pdf/style-tokens';
import { findTreeByRouteParam } from '@/server/services/tree.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Params = { locale: string; shortCode: string };
type SearchParams = { regenerate?: string; baseStyleId?: string };

export default async function PosterDesignerPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, shortCode } = await params;
  const sp = await searchParams;

  const tree = await findTreeByRouteParam(shortCode);
  if (!tree) redirect(`/${locale}/tree/${shortCode}`);

  const role = await getCurrentUserTreeRole(tree.id);
  if (!role) redirect(`/${locale}/tree/${shortCode}`);

  const baseStyleId = sp.baseStyleId ?? DEFAULT_STYLE_ID;
  const regenerate = sp.regenerate === '1' || sp.regenerate === 'true';

  const session = await generatePosterSession({
    shortCode,
    baseStyleId,
    regenerate,
  });
  if (!session) redirect(`/${locale}/tree/${shortCode}`);

  return (
    <PosterDesignerClient
      locale={locale}
      shortCode={shortCode}
      treeName={session.treeName}
      planBase64={session.planBase64}
      variantId={session.variantId}
      baseStyleId={session.baseStyleId}
      renderToken={getPdfRenderSecret()}
    />
  );
}
