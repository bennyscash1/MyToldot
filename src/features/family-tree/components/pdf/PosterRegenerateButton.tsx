'use client';

import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import { useCallback, useState } from 'react';

export function PosterRegenerateButton({
  shortCode,
  baseStyleId,
}: {
  shortCode: string;
  baseStyleId: string;
}) {
  const t = useTranslations('treePdf');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onRegenerate = useCallback(() => {
    if (busy) return;
    setBusy(true);
    const qs = new URLSearchParams({
      regenerate: '1',
      baseStyleId,
      _: String(Date.now()),
    });
    router.push(`/tree/${shortCode}/poster?${qs.toString()}`);
  }, [baseStyleId, busy, router, shortCode]);

  return (
    <button
      type="button"
      onClick={onRegenerate}
      disabled={busy}
      className="inline-flex h-10 items-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? t('loading') : t('regenerate')}
    </button>
  );
}
