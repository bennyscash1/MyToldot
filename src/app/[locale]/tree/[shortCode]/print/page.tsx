import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PosterDocument } from '@/features/family-tree/components/pdf/PosterDocument';
import { PosterFontLinks } from '@/features/family-tree/components/pdf/PosterFontLinks';
import { isValidPdfRenderToken } from '@/server/lib/pdf/pdf-render-auth';
import { DEFAULT_STYLE_ID } from '@/server/lib/pdf/style-tokens';
import { resolvePosterRenderData } from '@/server/lib/pdf/resolve-poster-data';
import { buildVariantId } from '@/server/lib/pdf/variants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Params = { locale: string; shortCode: string };
type SearchParams = { styleId?: string; plan?: string; renderToken?: string };

const READY_SCRIPT = `(function(){
  function markReady(){ document.documentElement.setAttribute('data-pdf-ready','true'); }
  function imagesDone(){
    var imgs = Array.prototype.slice.call(document.images);
    return Promise.all(imgs.map(function(img){
      if (img.complete) return Promise.resolve();
      return new Promise(function(res){ img.addEventListener('load', res); img.addEventListener('error', res); });
    }));
  }
  var fonts = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.all([fonts, imagesDone()]).then(markReady).catch(markReady);
})();`;

export default async function TreePrintPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, shortCode } = await params;
  const sp = await searchParams;

  if (!isValidPdfRenderToken(sp.renderToken)) {
    notFound();
  }

  const variantId =
    sp.styleId ??
    buildVariantId(DEFAULT_STYLE_ID, 'unknown', '0', 1);

  const data = await resolvePosterRenderData({
    shortCode,
    locale,
    variantId,
    planBase64: sp.plan,
  });
  if (!data) notFound();

  return (
    <>
      <PosterFontLinks />
      <PosterDocument
        dir={data.dir}
        styleToken={data.styleToken}
        borderUrl={data.borderUrl}
        usedCssFallback={data.usedCssFallback}
        variantIndex={data.variantIndex}
        treeName={data.treeName}
        introParagraphs={data.introParagraphs}
        treeLayout={data.treeLayout}
        personById={data.personById}
      />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script dangerouslySetInnerHTML={{ __html: READY_SCRIPT }} />
    </>
  );
}
