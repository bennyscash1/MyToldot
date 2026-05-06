'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

import { usePermissions } from '@/hooks/usePermissions';
import { useRouteLocale } from '@/hooks/useRouteLocale';
import { cn } from '@/lib/utils';
import type { Locale } from '@/i18n/routing';
import { updateUserLanguage } from '@/server/actions/user.actions';
import {
  PREFERRED_LOCALE_COOKIE,
  PREFERRED_LOCALE_MAX_AGE_SECONDS,
} from '@/lib/locale-preference';

// ──────────────────────────────────────────────
// LanguageSwitcher
//
// Client Component — useRouter + useRouteLocale (URL segment, not stale useLocale).
// Renders a compact EN / HE pill toggle.
// Uses next-intl's typed router so locale switching
// preserves the current pathname automatically.
// ──────────────────────────────────────────────

const LOCALES: { value: Locale; labelKey: 'en' | 'he' }[] = [
  { value: 'en', labelKey: 'en' },
  { value: 'he', labelKey: 'he' },
];

function getInternalPath(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(en|he)(?=\/|$)/, '');
  return withoutLocale.length > 0 ? withoutLocale : '/';
}

function persistGuestLocaleCookie(nextLocale: Locale) {
  document.cookie = `${PREFERRED_LOCALE_COOKIE}=${nextLocale}; path=/; max-age=${PREFERRED_LOCALE_MAX_AGE_SECONDS}; samesite=lax`;
}

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useRouteLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = usePermissions();

  async function handleSwitch(nextLocale: Locale) {
    if (nextLocale === locale) return;
    persistGuestLocaleCookie(nextLocale);
    if (isAuthenticated) {
      const res = await updateUserLanguage(nextLocale);
      if (!res.ok && process.env.NODE_ENV !== 'production') {
        console.warn('[LanguageSwitcher] Failed to persist locale in DB:', res.error.message);
      }
    }
    router.replace(getInternalPath(pathname), { locale: nextLocale });
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex max-w-full shrink-0 items-center rounded-full border border-gray-200 bg-gray-50 p-0.5"
    >
      {LOCALES.map(({ value, labelKey }) => {
        const isActive = value === locale;
        return (
          <button
            key={value}
            type="button"
            onClick={() => void handleSwitch(value)}
            aria-pressed={isActive}
            className={cn(
              'min-h-10 min-w-[2.75rem] rounded-full px-3 py-2 text-xs font-semibold transition-all duration-200 sm:min-h-8 sm:py-1',
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
