const ISRAEL_DAY_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Calendar day in Israel ("YYYY-MM-DD") for daily quota buckets. */
export function getIsraelDay(date: Date = new Date()): string {
  return ISRAEL_DAY_FORMATTER.format(date);
}
