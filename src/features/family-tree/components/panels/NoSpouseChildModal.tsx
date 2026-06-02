'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export interface NoSpouseChildModalProps {
  open: boolean;
  personName: string;
  onAddSpouseFirst: () => void;
  onSingleParent: () => void;
  onCancel: () => void;
}

export function NoSpouseChildModal({
  open,
  personName,
  onAddSpouseFirst,
  onSingleParent,
  onCancel,
}: NoSpouseChildModalProps) {
  const t = useTranslations('addChildFlow');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const groupId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);
  const [selected, setSelected] = useState<'spouse' | 'single'>('spouse');

  useEffect(() => {
    if (open) setSelected('spouse');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleContinue() {
    if (selected === 'spouse') onAddSpouseFirst();
    else onSingleParent();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-spouse-child-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="no-spouse-child-title" className="text-base font-semibold text-slate-900">
          {t('noSpouseTitle', { personName })}
        </h3>
        <p className="mt-2 text-sm text-slate-700">{t('noSpouseBody', { personName })}</p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{t('noSpouseTitle', { personName })}</legend>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <input
              type="radio"
              name={groupId}
              checked={selected === 'spouse'}
              onChange={() => setSelected('spouse')}
              className="mt-1 text-emerald-600"
            />
            <span>{t('addSpouseFirst', { personName })}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <input
              type="radio"
              name={groupId}
              checked={selected === 'single'}
              onChange={() => setSelected('single')}
              className="mt-1 text-emerald-600"
            />
            <span>{t('singleParentChild', { personName })}</span>
          </label>
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="button" variant="primary" onClick={handleContinue}>
            {t('continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
