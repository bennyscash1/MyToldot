/**
 * Lightweight Hebrew → Latin romanization used ONLY for image search queries
 * (Wikimedia Commons + Google-grounded Gemini). It is intentionally fuzzy:
 * Commons CirrusSearch is typo-tolerant, so an approximate romanization like
 * "Meir Banai" is enough to surface the right Wikipedia/Commons files for
 * well-known public figures whose person record has no Latin name.
 *
 * This is NOT a general-purpose transliterator and is deliberately scoped to
 * the images feature so it never affects bio / tree-builder prompts.
 */

/** High-frequency first names + surnames where char-level mapping is poor. */
const KNOWN_NAME_MAP: Record<string, string> = {
  // First names
  אברהם: 'Abraham',
  יצחק: 'Yitzhak',
  יעקב: 'Yaakov',
  משה: 'Moshe',
  אהרן: 'Aharon',
  אהרון: 'Aharon',
  דוד: 'David',
  שלמה: 'Shlomo',
  יהודה: 'Yehuda',
  יוסף: 'Yosef',
  ישראל: 'Israel',
  אליהו: 'Eliyahu',
  מנחם: 'Menachem',
  שמואל: 'Shmuel',
  יהושע: 'Yehoshua',
  מאיר: 'Meir',
  חיים: 'Chaim',
  שמעון: 'Shimon',
  אריק: 'Arik',
  אריאל: 'Ariel',
  גדעון: 'Gideon',
  נתן: 'Natan',
  עמיר: 'Amir',
  אהוד: 'Ehud',
  בנימין: 'Benjamin',
  // First names — women
  שרה: 'Sara',
  רחל: 'Rachel',
  לאה: 'Leah',
  רבקה: 'Rivka',
  חנה: 'Chana',
  אסתר: 'Esther',
  מירי: 'Miri',
  יעל: 'Yael',
  נעמי: 'Naomi',
  תמר: 'Tamar',
  // Surnames
  כהן: 'Cohen',
  לוי: 'Levi',
  הלוי: 'Halevi',
  כץ: 'Katz',
  פרידמן: 'Friedman',
  רוזנברג: 'Rosenberg',
  גולדברג: 'Goldberg',
  שפירא: 'Shapira',
  בנאי: 'Banai',
  ברלוביץ: 'Berlovich',
  פרץ: 'Peretz',
  גבאי: 'Gabai',
  ביטון: 'Biton',
  אלון: 'Alon',
};

/** Most common single-output Latin equivalent per Hebrew letter. */
const CHAR_MAP: Record<string, string> = {
  א: '',
  ב: 'b',
  ג: 'g',
  ד: 'd',
  ה: 'h',
  ו: 'v',
  ז: 'z',
  ח: 'ch',
  ט: 't',
  י: 'y',
  כ: 'k',
  ך: 'k',
  ל: 'l',
  מ: 'm',
  ם: 'm',
  נ: 'n',
  ן: 'n',
  ס: 's',
  ע: '',
  פ: 'p',
  ף: 'f',
  צ: 'tz',
  ץ: 'tz',
  ק: 'k',
  ר: 'r',
  ש: 'sh',
  ת: 't',
};

const HEBREW_LETTER = /[\u05D0-\u05EA]/;

function hasHebrew(text: string): boolean {
  return HEBREW_LETTER.test(text);
}

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Char-level romanization of a single Hebrew token (best-effort). */
function romanizeToken(token: string): string {
  if (KNOWN_NAME_MAP[token]) return KNOWN_NAME_MAP[token];

  let out = '';
  for (const ch of token) {
    out += CHAR_MAP[ch] ?? (HEBREW_LETTER.test(ch) ? '' : ch);
  }
  // Hebrew words almost always need a vowel to be searchable; if the mapping
  // collapsed to a bare consonant cluster, insert "a" between consonants.
  if (out && !/[aeiou]/i.test(out) && out.length > 1) {
    out = out.split('').join('a');
  }
  return capitalize(out);
}

/**
 * Romanize a full Hebrew name into a single Latin string (token by token).
 * Returns '' when the input has no Hebrew letters.
 */
export function romanizeHebrewName(hebrewName: string): string {
  const trimmed = hebrewName.trim();
  if (!trimmed || !hasHebrew(trimmed)) return '';

  return trimmed
    .split(/\s+/)
    .map(romanizeToken)
    .filter(Boolean)
    .join(' ')
    .trim();
}
