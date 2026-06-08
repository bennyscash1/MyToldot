'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { PosterDownloadButton } from '@/components/features/tree/PosterDownloadButton';
import styles from '@/app/[locale]/tree/[shortCode]/poster/poster.module.css';

import { PosterPreviewFrame } from './PosterPreviewFrame';
import { PosterRegenerateButton } from './PosterRegenerateButton';

export function PosterDesignerClient({
  locale,
  shortCode,
  treeName,
  planBase64,
  variantId,
  baseStyleId,
  renderToken,
}: {
  locale: string;
  shortCode: string;
  treeName: string;
  planBase64: string;
  variantId: string;
  baseStyleId: string;
  renderToken?: string | null;
}) {
  const t = useTranslations('treePdf');
  const encodedPlan = encodeURIComponent(planBase64);
  const tokenQs = renderToken ? `&renderToken=${encodeURIComponent(renderToken)}` : '';
  const src = `/${locale}/tree/${shortCode}/print?styleId=${encodeURIComponent(variantId)}&plan=${encodedPlan}${tokenQs}`;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('previewTitle', { name: treeName })}</h1>
        </div>
        <div className={styles.actions}>
          <Link
            href={`/tree/${shortCode}`}
            className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {t('backToTree')}
          </Link>
          <PosterRegenerateButton shortCode={shortCode} baseStyleId={baseStyleId} />
        </div>
      </header>

      <div className={styles.previewArea}>
        <PosterPreviewFrame src={src} />
      </div>

      <footer className={styles.footer}>
        <PosterDownloadButton
          locale={locale}
          shortCode={shortCode}
          variantId={variantId}
          planBase64={planBase64}
        />
      </footer>
    </div>
  );
}
