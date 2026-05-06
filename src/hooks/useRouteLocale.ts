'use client';

import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';

import { isValidLocale, type Locale } from '@/i18n/routing';

/**
 * Active locale from the URL segment (`/[locale]/...`).
 * Prefer this over `useLocale()` alone — after `router.replace(..., { locale })`
 * the segment updates immediately while `useLocale()` can briefly (or stuck) match
 * `defaultLocale` and block switching back (e.g. EN → HE no-op).
 */
export function useRouteLocale(): Locale {
  const params = useParams();
  const intlFallback = useLocale() as Locale;
  const raw = params?.locale;
  if (typeof raw === 'string' && isValidLocale(raw)) {
    return raw;
  }
  return intlFallback;
}
