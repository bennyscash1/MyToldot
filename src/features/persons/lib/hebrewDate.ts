import { HDate } from '@hebcal/core';

// ────────────────────────────────────────────────────────────────
// Gregorian ↔ Hebrew date helpers.
//
// The DB stores Gregorian only (single source of truth). Hebrew dates are
// computed on the fly whenever a Gregorian date is rendered. @hebcal/core
// is small (~40 KB gzipped) and runs purely client-side — no network.
//
// renderGematriya() emits the traditional Hebrew letter form:
//   27 Nisan 5785  →  "כ״ז בְּנִיסָן תשפ״ה"
// which is what Israeli users expect. The simple ASCII form ("27 Nisan
// 5785") is available via render('en') if we ever need a Latin fallback.
// ────────────────────────────────────────────────────────────────

/** Converts a JS Date (or ISO string) to the Hebrew date rendered in Hebrew letters. */
export function gregorianToHebrewText(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  try {
    const hd = new HDate(date);
    return hd.renderGematriya();
  } catch {
    // HDate throws on dates before the Gregorian→Julian cutoff. Users
    // entering such dates is extremely unlikely, but don't crash the form.
    return null;
  }
}

/** A shorter "day month" form used as a caption under the Gregorian input.
 *  Example: "כ״ז בניסן" (no year). */
export function gregorianToHebrewMonthDay(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const hd = new HDate(date);
    const full = hd.renderGematriya();
    // renderGematriya() returns e.g. "כ״ז בְּנִיסָן תשפ״ה". Strip the year
    // (last whitespace-separated token).
    const idx = full.lastIndexOf(' ');
    return idx === -1 ? full : full.slice(0, idx);
  } catch {
    return null;
  }
}
