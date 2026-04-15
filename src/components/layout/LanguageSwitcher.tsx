'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';

// ──────────────────────────────────────────────
// LanguageSwitcher
//
// Client Component — needs useRouter / useLocale.
// Renders a compact EN / HE pill toggle.
// Uses next-intl's typed router so locale switching
// preserves the current pathname automatically.
// ──────────────────────────────────────────────

const LOCALES: { value: Locale; labelKey: 'en' | 'he' }[] = [
  { value: 'en', labelKey: 'en' },
  { value: 'he', labelKey: 'he' },
];

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  function handleSwitch(nextLocale: Locale) {
    if (nextLocale === locale) return;
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5"
    >
      {LOCALES.map(({ value, labelKey }) => {
        const isActive = value === locale;
        return (
          <button
            key={value}
            onClick={() => handleSwitch(value)}
            aria-pressed={isActive}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200',
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600',
            )}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
