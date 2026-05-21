'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';

export type CoParentOption = { id: string; name: string };

export interface PickCoParentModalProps {
  open: boolean;
  personName: string;
  spouseOptions: CoParentOption[];
  onConfirm: (coParentId: string | null) => void;
  onCancel: () => void;
}

export function PickCoParentModal({
  open,
  personName,
  spouseOptions,
  onConfirm,
  onCancel,
}: PickCoParentModalProps) {
  const t = useTranslations('addChildFlow');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const groupId = useId();
  const [selected, setSelected] = useState<string>('single');

  useEffect(() => {
    if (open) {
      setSelected(spouseOptions[0]?.id ?? 'single');
    }
  }, [open, spouseOptions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-coparent-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="pick-coparent-title" className="text-base font-semibold text-slate-900">
          {t('pickCoParentTitle')}
        </h3>
        <p className="mt-2 text-sm text-slate-700">{t('pickCoParentBody', { personName })}</p>

        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{t('pickCoParentTitle')}</legend>
          {spouseOptions.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <input
                type="radio"
                name={groupId}
                checked={selected === opt.id}
                onChange={() => setSelected(opt.id)}
                className="text-emerald-600"
              />
              <span>{opt.name}</span>
            </label>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
            <input
              type="radio"
              name={groupId}
              checked={selected === 'single'}
              onChange={() => setSelected('single')}
              className="text-emerald-600"
            />
            <span>{t('singleParentOnly', { personName })}</span>
          </label>
        </fieldset>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onConfirm(selected === 'single' ? null : selected)}
          >
            {t('continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}
