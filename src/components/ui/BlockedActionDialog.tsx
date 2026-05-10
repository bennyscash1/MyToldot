'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';

export interface BlockedActionDialogProps {
  open: boolean;
  ownerEmail?: string | null;
  onClose: () => void;
}

export function BlockedActionDialog({ open, ownerEmail, onClose }: BlockedActionDialogProps) {
  const t = useTranslations('branching.blocked');
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

  if (!open) return null;

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
        aria-labelledby="blocked-action-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="blocked-action-title" className="text-base font-semibold text-slate-900">
          {t('title')}
        </h3>
        <p className="mt-2 text-sm text-slate-700">{t('body')}</p>
        {ownerEmail ? (
          <p className="mt-3 text-sm text-slate-700">
            {t('contactOwner')}{' '}
            <a
              className="font-medium text-emerald-700 underline hover:text-emerald-800"
              href={`mailto:${ownerEmail}`}
            >
              {ownerEmail}
            </a>
          </p>
        ) : null}
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="primary" onClick={onClose}>
            {t('close')}
          </Button>
        </div>
      </div>
    </div>
  );
}
