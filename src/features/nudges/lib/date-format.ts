/**
 * Format a local Date as a "YYYY-MM-DD" string using local components
 * (no timezone drift — `toISOString()` converts to UTC, which can move the
 * day by one for IST/local users).
 */
export function dateToIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
