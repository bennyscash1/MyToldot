import { getRequestConfig } from 'next-intl/server';
import { routing, isValidLocale } from './routing';

// ──────────────────────────────────────────────
// Server-side i18n config.
// next-intl calls this per-request to resolve the
// active locale and load the matching messages file.
// ──────────────────────────────────────────────

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale comes from the [locale] segment in the URL.
  let locale = await requestLocale;

  // Guard: fall back to default if locale is missing or unknown.
  if (!locale || !isValidLocale(locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
