// Civil Gregorian dates — display dd/mm/yyyy, store as UTC date-only.

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const DD_MM_YYYY = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCivilDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** [year, month (1–12), day] from a stored date or display string. */
export function extractCivilDateParts(
  input: Date | string,
): [year: number, month: number, day: number] | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const iso = ISO_DATE_ONLY.exec(trimmed);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      return isValidCivilDate(year, month, day) ? [year, month, day] : null;
    }

    const dmy = DD_MM_YYYY.exec(trimmed);
    if (dmy) {
      const day = Number(dmy[1]);
      const month = Number(dmy[2]);
      const year = Number(dmy[3]);
      return isValidCivilDate(year, month, day) ? [year, month, day] : null;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return [
      parsed.getUTCFullYear(),
      parsed.getUTCMonth() + 1,
      parsed.getUTCDate(),
    ];
  }

  if (Number.isNaN(input.getTime())) return null;
  return [
    input.getUTCFullYear(),
    input.getUTCMonth() + 1,
    input.getUTCDate(),
  ];
}

/** Format as dd/mm/yyyy for inputs and labels. */
export function formatGregorianDate(
  input: Date | string | null | undefined,
): string {
  if (!input) return '';
  const parts = extractCivilDateParts(
    input instanceof Date ? input : String(input),
  );
  if (!parts) return '';
  const [year, month, day] = parts;
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

/** Parse dd/mm/yyyy or yyyy-mm-dd to UTC midnight (DATE column safe). */
export function parseGregorianDate(value: string): Date | null {
  const parts = extractCivilDateParts(value);
  if (!parts) return null;
  const [year, month, day] = parts;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Normalize user input on blur (e.g. 1/1/1930 → 01/01/1930). */
export function normalizeGregorianDisplayInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = parseGregorianDate(trimmed);
  return parsed ? formatGregorianDate(parsed) : trimmed;
}

export function todayGregorianDisplay(): string {
  return formatGregorianDate(new Date());
}

/** Parse API / form string or Date for persistence. */
export function coerceGregorianDate(
  value: string | Date | null | undefined,
): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const parts = extractCivilDateParts(value);
    if (!parts) return null;
    const [year, month, day] = parts;
    return new Date(Date.UTC(year, month - 1, day));
  }
  return parseGregorianDate(value);
}
