import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

// ──────────────────────────────────────────────
// Locale routing definition — single source of truth.
// Import `routing` anywhere you need the locales array
// or the defaultLocale string (middleware, layout, tests).
// ──────────────────────────────────────────────

export const routing = defineRouting({
  locales: ['en', 'he'],
  defaultLocale: 'he',
});

/** Union type derived from the locales array. */
export type Locale = (typeof routing.locales)[number];

/** Utility: is a string a valid Locale? */
export function isValidLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

// ──────────────────────────────────────────────
// Typed navigation helpers — generated from the
// routing config so they're always locale-aware.
//
// Usage (Server or Client Components):
//   import { Link, useRouter, usePathname } from '@/i18n/routing';
// ──────────────────────────────────────────────

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
