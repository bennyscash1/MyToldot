'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function PosterDownloadButton({
  locale,
  shortCode,
  variantId,
  planBase64,
  disabled,
}: {
  locale: string;
  shortCode: string;
  variantId: string | null;
  planBase64: string;
  disabled?: boolean;
}) {
  const t = useTranslations('treePdf');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!variantId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/${locale}/tree/${shortCode}/pdf?styleId=${encodeURIComponent(variantId)}&plan=${encodeURIComponent(planBase64)}`;
      const res = await fetch(url);
      if (!res.ok) {
        let msg = t('error');
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body.error?.message) msg = body.error.message;
        } catch {
          // keep default
        }
        setError(msg);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `toldotay-${shortCode}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || loading || !variantId}
        onClick={() => void handleDownload()}
        className="inline-flex h-11 min-w-[200px] items-center justify-center rounded-xl bg-emerald-600 px-8 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? t('generating') : t('download')}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
