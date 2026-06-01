'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import type { UsageScopeValue } from '@/lib/usage/limits';

export interface QuotaExceededDialogProps {
  open: boolean;
  scope: UsageScopeValue | null;
  current: number;
  limit: number;
  onClose: () => void;
}

export function QuotaExceededDialog({
  open,
  scope,
  current,
  limit,
  onClose,
}: QuotaExceededDialogProps) {
  const t = useTranslations('quota');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !scope) return null;

  const isAi = scope === 'ai_bios';
  const title = isAi ? t('ai.title') : t('images.title');
  const body = isAi
    ? t('ai.body', { current, limit })
    : t('images.body', { current, limit });
  const hint = isAi ? t('ai.hint') : t('images.hint');

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quota-exceeded-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="quota-exceeded-title" className="text-base font-semibold text-slate-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-700">{body}</p>
        <p className="mt-3 text-sm text-slate-600">{hint}</p>
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="primary" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
