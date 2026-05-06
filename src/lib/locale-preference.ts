// ──────────────────────────────────────────────
// Locale preference — shared by middleware (Edge),
// server actions, and API routes.
//
// Cookie mirrors DB (`User.preferred_language`) so Edge
// middleware can avoid calling Prisma.
// ──────────────────────────────────────────────

import { z } from 'zod';

export const PREFERRED_LOCALE_COOKIE = 'PREFERRED_LOCALE';
export const PREFERRED_LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const PreferredLocaleSchema = z.enum(['he', 'en']);

export type PreferredLocale = z.infer<typeof PreferredLocaleSchema>;

export function parsePreferredLocale(value: unknown): PreferredLocale | null {
  const r = PreferredLocaleSchema.safeParse(value);
  return r.success ? r.data : null;
}

export function parsePreferredLocaleCookie(
  value: string | undefined,
): PreferredLocale | null {
  if (value === undefined) return null;
  return parsePreferredLocale(value);
}
