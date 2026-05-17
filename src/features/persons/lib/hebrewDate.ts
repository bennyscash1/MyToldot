import { HDate } from '@hebcal/core';

import { extractCivilDateParts } from '@/lib/dates/gregorian';

// ────────────────────────────────────────────────────────────────
// Gregorian → Hebrew date helpers.
//
// DB stores Gregorian dates; Hebrew strings are derived on write and
// persisted for display. DATE-only values are anchored to the civil
// calendar day (UTC components from DB / ISO / dd/mm/yyyy strings),
// then passed to HDate via a local Date at noon.
// ────────────────────────────────────────────────────────────────

/** Civil calendar date at local noon — stable for HDate(Date) conversion. */
function civilDateAtNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function parseDate(input: Date | string | null | undefined): Date | null {
  if (!input) return null;

  if (typeof input === 'string') {
    const parts = extractCivilDateParts(input);
    if (!parts) return null;
    const [year, month, day] = parts;
    return civilDateAtNoon(year, month - 1, day);
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  return civilDateAtNoon(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

/** Gregorian civil date → Hebrew HDate (not the 3-arg Hebrew-calendar ctor). */
function toHDate(civilDate: Date): HDate {
  return new HDate(civilDate);
}

/**
 * Translates a Gregorian Date to a Hebrew date string with gershayim.
 * Format: "כ״ה בכסלו תקצ״א"
 * Returns null for null/undefined/invalid input.
 */
export function gregorianToHebrew(date: Date | string | null | undefined): string | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  try {
    return toHDate(parsed).renderGematriya();
  } catch {
    return null;
  }
}

/**
 * Returns just the Hebrew year, e.g. "תקצ״א"
 */
export function gregorianToHebrewYear(date: Date | string | null | undefined): string | null {
  const full = gregorianToHebrew(date);
  if (!full) return null;
  const idx = full.lastIndexOf(' ');
  return idx === -1 ? full : full.slice(idx + 1);
}

/** @deprecated Use gregorianToHebrew — kept for PersonForm live preview. */
export const gregorianToHebrewText = gregorianToHebrew;

/** Day + month only (no year). Example: "כ״ז בניסן". */
export function gregorianToHebrewMonthDay(input: Date | string | null | undefined): string | null {
  const full = gregorianToHebrew(input);
  if (!full) return null;
  const idx = full.lastIndexOf(' ');
  return idx === -1 ? full : full.slice(0, idx);
}

export interface HebrewDateFields {
  birth_date_hebrew: string | null;
  birth_year_hebrew: string | null;
  death_date_hebrew: string | null;
  death_year_hebrew: string | null;
}

type GregorianInput = Date | string | null | undefined;

/** Derives persisted Hebrew date columns from Gregorian + life status. */
export function deriveHebrewDateFields(input: {
  birth_date?: GregorianInput;
  death_date?: GregorianInput;
  is_deceased?: boolean;
}): HebrewDateFields {
  const birthDate = input.birth_date ?? null;
  const isDeceased = input.is_deceased ?? false;
  const deathDate = isDeceased && input.death_date != null ? input.death_date : null;

  return {
    birth_date_hebrew: gregorianToHebrew(birthDate),
    birth_year_hebrew: gregorianToHebrewYear(birthDate),
    death_date_hebrew: gregorianToHebrew(deathDate),
    death_year_hebrew: gregorianToHebrewYear(deathDate),
  };
}
