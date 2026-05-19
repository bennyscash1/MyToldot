// Civil Gregorian dates — display dd/mm/yyyy, store as UTC date-only.

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const DD_MM_YYYY = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;
const DIGITS_ONLY_8 = /^\d{8}$/;

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

    if (DIGITS_ONLY_8.test(trimmed)) {
      const day = Number(trimmed.slice(0, 2));
      const month = Number(trimmed.slice(2, 4));
      const year = Number(trimmed.slice(4, 8));
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

/** Format typed digits as dd/mm/yyyy with auto-slashes (max 8 digits). */
export function formatDigitsAsDdMmYyyy(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Normalize pasted or mixed separators to dd/mm/yyyy display, or '' if invalid. */
export function normalizePastedDate(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const parsed = parseGregorianDate(trimmed);
  return parsed ? formatGregorianDate(parsed) : '';
}

/** Civil date at local noon for calendar UI (avoids TZ drift in DayPicker). */
export function dateToPickerDate(date: Date): Date {
  const parts = extractCivilDateParts(date);
  if (!parts) return new Date();
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Convert a DayPicker selection to stored UTC date-only. */
export function pickerDateToStoredDate(selected: Date): Date | null {
  const y = selected.getFullYear();
  const m = selected.getMonth() + 1;
  const d = selected.getDate();
  return parseGregorianDate(`${pad2(d)}/${pad2(m)}/${y}`);
}

/** ISO date-only string (yyyy-mm-dd) for REST bodies. */
export function gregorianDateToIsoDateOnly(date: Date): string {
  const parts = extractCivilDateParts(date);
  if (!parts) return '';
  const [year, month, day] = parts;
  return `${year}-${pad2(month)}-${pad2(day)}`;
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
