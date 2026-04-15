// ============================================================
// ShorTree — Shared TypeScript Types
// All UI-facing and utility types live here.
// Domain/DB models are derived from Prisma in lib/prisma.ts (Phase 4).
// ============================================================

import type { Locale } from '@/i18n/routing';

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────

/** A single entry in the main navigation bar. */
export interface NavItem {
  /** Translation key, e.g. "nav.home" */
  labelKey: string;
  /** Next.js App Router href */
  href: string;
  /** Disable the link (e.g. feature not yet available) */
  disabled?: boolean;
}

// ─────────────────────────────────────────────
// Layout / i18n
// ─────────────────────────────────────────────

/** HTML `dir` attribute value. */
export type TextDirection = 'ltr' | 'rtl';

/** Maps a Locale to its text direction. */
export const LOCALE_DIR: Record<Locale, TextDirection> = {
  en: 'ltr',
  he: 'rtl',
};

// ─────────────────────────────────────────────
// Generic utility types
// ─────────────────────────────────────────────

/** Page props injected by Next.js App Router for [locale] segments. */
export interface LocalePageProps {
  params: Promise<{ locale: Locale }>;
}
