'use client';

import { useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { usePermissions } from '@/hooks/usePermissions';
import type { PreferredLocale } from '@/lib/locale-preference';
import { cn } from '@/lib/utils';
import { updateUserLanguage } from '@/server/actions/user.actions';

// ──────────────────────────────────────────────
// About — prominent language control (persisted
// when signed in via updateUserLanguage).
// Navigation uses next/navigation per product spec.
// ──────────────────────────────────────────────

function replacePathLocale(pathname: string, locale: PreferredLocale): string {
  const m = pathname.match(/^\/(en|he)(\/.*|$)/);
  if (m) {
    return pathname.replace(/^\/(en|he)/, `/${locale}`);
  }
  return `/${locale}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export function AboutLanguagePreference() {
  const t = useTranslations('aboutPage');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = usePermissions();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function navigateToLocale(next: PreferredLocale) {
    router.replace(replacePathLocale(pathname, next));
    router.refresh();
  }

  function handleChoose(next: PreferredLocale) {
    if (next === locale) return;
    setError(null);
    startTransition(async () => {
      if (isAuthenticated) {
        const res = await updateUserLanguage(next);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
      }
      navigateToLocale(next);
    });
  }

  return (
    <section
      className="mx-auto mb-8 w-full max-w-3xl rounded-2xl border border-amber-200/80 bg-amber-50/50 px-3 py-4 sm:px-6 sm:py-5 lg:px-8"
      aria-labelledby="about-lang-heading"
    >
      <h2
        id="about-lang-heading"
        className="text-lg font-semibold tracking-tight text-gray-900"
      >
        {t('languageHeading')}
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        {isAuthenticated ? t('languageHintSignedIn') : t('languageHintGuest')}
      </p>
      {error ? (
        <p className="mt-2 text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:flex sm:flex-wrap">
        {(
          [
            { code: 'he' as const, label: t('languageHebrew') },
            { code: 'en' as const, label: t('languageEnglish') },
          ] as const
        ).map(({ code, label }) => {
          const isActive = code === locale;
          return (
            <button
              key={code}
              type="button"
              disabled={pending}
              onClick={() => handleChoose(code)}
              aria-pressed={isActive}
              className={cn(
                'min-h-[48px] w-full rounded-xl border px-4 py-3 text-center text-sm font-semibold transition-colors sm:w-auto sm:min-w-[9rem] sm:px-5',
                isActive
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50',
                pending && 'opacity-60',
              )}
            >
              <span className="block">{label}</span>
              {isActive ? (
                <span className="mt-0.5 block text-[11px] font-normal opacity-90">
                  {t('languageActive')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
