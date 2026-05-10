'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { updateTreeSettingsAction } from '@/server/actions/tree.actions';

export function AllowBranchingToggle({
  treeId,
  initialValue,
}: {
  treeId: string;
  initialValue: boolean;
}) {
  const t = useTranslations('branching');
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="mb-6 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{t('toggleLabel')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('toggleHelp')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label={t('toggleLabel')}
          disabled={isPending}
          onClick={() => {
            const next = !value;
            setValue(next);
            setError(null);
            startTransition(async () => {
              const r = await updateTreeSettingsAction(treeId, { allow_branching: next });
              if (!r.ok) {
                setValue(!next);
                setError(r.error.message);
              }
            });
          }}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
            value ? 'bg-emerald-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
              value
                ? 'translate-x-[1.375rem] rtl:-translate-x-[1.375rem]'
                : 'translate-x-0.5 rtl:-translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
