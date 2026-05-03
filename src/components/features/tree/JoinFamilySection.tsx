'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';

import { joinFamilyByCode } from '@/server/actions/tree.actions';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function JoinFamilySection() {
  const t = useTranslations('home');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = code.replace(/\D/g, '').slice(0, 5);
    if (digits.length !== 5) {
      setError(t('joinFamilyCodeInvalid'));
      return;
    }
    startTransition(async () => {
      const result = await joinFamilyByCode(digits);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/tree/${result.data.shortCode}`);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-4 text-start shadow-sm backdrop-blur-sm sm:flex-row sm:items-end"
      dir="rtl"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label htmlFor="join-family-code" className="text-sm font-medium text-slate-700">
          {t('joinFamilyTitle')}
        </label>
        <Input
          id="join-family-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={5}
          placeholder={t('joinFamilyPlaceholder')}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
          className="text-center font-mono text-lg tracking-[0.2em]"
          aria-invalid={error ? true : undefined}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <Button type="submit" disabled={isPending} className="shrink-0 sm:mb-0">
        {isPending ? t('joinFamilySubmitting') : t('joinFamilySubmit')}
      </Button>
    </form>
  );
}
