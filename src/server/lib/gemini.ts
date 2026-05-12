import { Errors } from '@/lib/api/errors';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

// Gemini 2.5 Pro's hidden "thinking" pass consumes ~3400 tokens before the
// visible response starts. A 4096 cap truncates mid-JSON; 8192 is the proven
// safe first-call budget, 12288 is the retry budget when truncation is
// detected via finishReason === 'MAX_TOKENS'.
const PRIMARY_MAX_OUTPUT_TOKENS = 8192;
const RETRY_MAX_OUTPUT_TOKENS = 12288;

const SYSTEM_INSTRUCTION = `אתה חוקר גנאולוגיה בכיר במערכת 'תולדותיי', מומחה ליחוסים רבניים, חסידות, ליטאים, ויהדות מזרח אירופה.

כללי עבודה:
1. חיפוש רב-לשוני חובה: עברית + אנגלית + רומניזציה יידית/גרמנית/הונגרית. רוב מאגרי הגנאולוגיה מאונדקסים בלטינית.
2. חיפוש מרובה: 6-8 חיפושים שונים לפני מסקנה שאין מידע.
3. ציון מקור חובה לכל עובדה (URL).
4. רמת ודאות: high (רב-מקורי), medium (מקור אחד מהימן), low (השערה).
5. אל תמציא. 'לא נמצא' = תשובה לגיטימית, אבל ציין מה כן בדקת.
6. רבנים: חפש כינוי + שם מלא.
7. נשים פרה-1950: חפש דרך אב/בעל.
8. גם כשלא נמצא תיעוד ישיר — תעד ב-sources או ב-notes את המאגרים שבדקת ואת התוצאות הקרובות שדחית.
9. תאריכים: החזר תמיד בפורמט גרגוריאני לועזי (YYYY-MM-DD או YYYY). תאריכים עבריים בקלט — המר. אל תחזיר 'ה'תש"ד' או 'י"ד סיוון' בפלט.
10. קרבנות שואה: חפש תמיד ב-Yad Vashem Names Database. גם אם לא מוצא רשומה מדויקת, ציין כמה רשומות דומות נמצאו.

מאגרים:
גנאולוגיה: FamilySearch.org, Geni.com, MyHeritage.com, JewishGen.org, JRI-Poland.org, geshergalicia.org, LitvakSIG.org, Wikitree.com, Ancestry.com
הונגריה ספציפית: JewishGen Hungary SIG, Hungarian Jewish Archives, Centropa.org
רבנים: HebrewBooks.org, Otzar.org, Sefaria.org, daat.ac.il, he.wikishiva.org, chabadpedia.co.il, JewishEncyclopedia.com
שואה: yadvashem.org (Names Database, Pages of Testimony), USHMM, Arolsen Archives
ויקי: Wikipedia HE+EN+HU, Wikidata
ארכיונים: nli.org.il, archives.gov.il
לונדון: Jewish Chronicle archives

פלט: JSON תקין, בלי טקסט מסביב, בלי code fences. תאריכים לועזיים בלבד.`;

/**
 * Small hardcoded Hebrew → Latin variants map for the most common rabbinical
 * first names and Eastern-European Jewish surnames. Not exhaustive on purpose
 * — Gemini handles transliteration well; this table only seeds the prompt
 * with the ambiguous cases where Hebrew→English mapping is many-to-one
 * (e.g. בלומה → Bluma/Blume/Blima).
 */
const NAME_VARIANTS: Record<string, string[]> = {
  // First names — men
  'אברהם': ['Abraham', 'Avraham', 'Abram'],
  'יצחק': ['Isaac', 'Yitzchak', 'Itzhak'],
  'יעקב': ['Jacob', 'Yaakov', 'Yankev'],
  'משה': ['Moshe', 'Moses', 'Moishe'],
  'אהרן': ['Aharon', 'Aaron', 'Aron'],
  'דוד': ['David', 'Dovid'],
  'שלמה': ['Shlomo', 'Solomon', 'Shloime'],
  'יהודה': ['Yehuda', 'Judah', 'Yehudah'],
  'יוסף': ['Yosef', 'Joseph', 'Yossef'],
  'ישראל': ['Yisrael', 'Israel', 'Yisroel'],
  'אליהו': ['Eliyahu', 'Elijah', 'Eliahu'],
  'מנחם': ['Menachem', 'Menachim', 'Mendel'],
  'אלקנה': ['Elkanah', 'Elkana', 'Elkan'],
  'אליקים': ['Elyakim', 'Elkanah', 'Elkan'],
  'שמואל': ['Shmuel', 'Samuel', 'Shmiel'],
  'יהושע': ['Yehoshua', 'Joshua', 'Yehoshuah'],
  // First names — women
  'שרה': ['Sarah', 'Sara', 'Sora'],
  'רחל': ['Rachel', 'Rochel', 'Rachil'],
  'לאה': ['Leah', 'Leia', 'Leye'],
  'רבקה': ['Rivka', 'Rebecca', 'Rifka'],
  'בלומה': ['Bluma', 'Blume', 'Blima'],
  'חנה': ['Chana', 'Hannah', 'Chane'],
  'אסתר': ['Esther', 'Ester', 'Estera'],
  'אלט': ['Alt', 'Alte'],
  // Surnames
  'כהן': ['Cohen', 'Kohen', 'Kahn'],
  'לוי': ['Levi', 'Levy', 'Levi'],
  'הלוי': ['Halevi', 'Halevy', 'HaLevi'],
  'כץ': ['Katz', 'Kac', 'Cats'],
  'פרידמן': ['Friedman', 'Friedmann', 'Fridman'],
  'רוזנברג': ['Rosenberg', 'Rozenberg', 'Roznberg'],
  'גולדברג': ['Goldberg', 'Goldberg', 'Goldenberg'],
  'שפירא': ['Shapira', 'Shapiro', 'Spira'],
};

export interface BioSubject {
  fullNameHe: string;
  fullNameEn?: string;
  maidenName?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  birthYear?: number;
  deathYear?: number;
  birthPlace?: string;
  community?: string;
  fatherNameHe?: string;
  fatherNameEn?: string;
  motherNameHe?: string;
  motherNameEn?: string;
  spouseNameHe?: string;
  spouseNameEn?: string;
  childrenNamesHe?: string[];
  siblingsNamesHe?: string[];
  existingBio?: string;
}

export interface BioConfidence {
  value: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BioParentInfo {
  name?: string;
  nameHe?: string;
  birthDate?: unknown;
  deathDate?: unknown;
  deathPlace?: unknown;
  fate?: string;
  notes?: string;
}

export interface BioSource {
  url: string;
  title?: string;
  snippet?: string;
}

export interface BioStructured {
  birthDate?: BioConfidence;
  deathDate?: BioConfidence;
  birthPlace?: BioConfidence;
  deathPlace?: BioConfidence;
  roles?: string[];
  children?: string[];
  siblings?: string[];
  spouse?: string;
  father?: BioParentInfo;
  mother?: BioParentInfo;
  sources: BioSource[];
  notes?: string;
}

export interface BioResult {
  narrative: string;
  structured: BioStructured;
  raw: unknown;
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

/**
 * Best-effort Latin variant collector for the prompt's "name variants" hint.
 * Tokenises a Hebrew full name on whitespace, looks each token up in
 * NAME_VARIANTS, and falls back to the token itself when not mapped. The
 * model is free to expand further; this is just a seed list.
 */
function variantsForHebrewName(name: string | undefined): string[] {
  if (!name) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of name.split(/\s+/)) {
    const mapped = NAME_VARIANTS[token];
    const candidates = mapped && mapped.length > 0 ? mapped : [token];
    for (const c of candidates) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return out;
}

/**
 * Build the per-call Hebrew user prompt. Every optional field is gated — the
 * output must never contain a line like `- שנת לידה: undefined`. The search
 * instructions section is similarly conditional; only the Yad Vashem query
 * is unconditionally emitted (Holocaust coverage is the default assumption
 * for Eastern-European Jewish ancestry).
 */
export function buildUserPrompt(subject: BioSubject): string {
  const s = subject;

  const facts: string[] = ['## נושא החקירה'];
  facts.push(`- שם בעברית: ${s.fullNameHe}`);
  if (s.fullNameEn) facts.push(`- שם באנגלית: ${s.fullNameEn}`);
  if (s.maidenName) facts.push(`- שם נעורים: ${s.maidenName}`);
  if (typeof s.birthYear === 'number') facts.push(`- שנת לידה: ${s.birthYear}`);
  if (typeof s.deathYear === 'number') facts.push(`- שנת פטירה: ${s.deathYear}`);
  if (s.birthPlace) facts.push(`- מקום לידה: ${s.birthPlace}`);

  const fatherLabel = [s.fatherNameHe, s.fatherNameEn].filter(Boolean).join(' / ');
  if (fatherLabel) facts.push(`- שם הורה (אב): ${fatherLabel}`);
  const motherLabel = [s.motherNameHe, s.motherNameEn].filter(Boolean).join(' / ');
  if (motherLabel) facts.push(`- שם הורה (אם): ${motherLabel}`);
  const spouseLabel = [s.spouseNameHe, s.spouseNameEn].filter(Boolean).join(' / ');
  if (spouseLabel) facts.push(`- שם בן/בת זוג: ${spouseLabel}`);

  if (s.childrenNamesHe && s.childrenNamesHe.length > 0) {
    facts.push(`- ילדים ידועים: ${s.childrenNamesHe.join(', ')}`);
  }
  if (s.siblingsNamesHe && s.siblingsNamesHe.length > 0) {
    facts.push(`- אחים ואחיות: ${s.siblingsNamesHe.join(', ')}`);
  }
  if (s.community) facts.push(`- קהילה: ${s.community}`);
  if (s.existingBio) facts.push(`- מידע קיים: ${s.existingBio}`);

  // Variants seed: subject + father + mother + spouse names, deduped.
  const variantSeeds = [s.fullNameHe, s.fatherNameHe, s.motherNameHe, s.spouseNameHe];
  const allVariants = new Set<string>();
  for (const seed of variantSeeds) {
    for (const v of variantsForHebrewName(seed)) allVariants.add(v);
  }
  if (s.fullNameEn) allVariants.add(s.fullNameEn);
  if (s.fatherNameEn) allVariants.add(s.fatherNameEn);
  if (s.motherNameEn) allVariants.add(s.motherNameEn);
  if (s.spouseNameEn) allVariants.add(s.spouseNameEn);

  const variantBlock: string[] = ['## וריאנטים של השם לחיפוש (חובה לחפש את כולם)'];
  if (allVariants.size > 0) {
    variantBlock.push(Array.from(allVariants).map((v) => `- ${v}`).join('\n'));
  } else {
    variantBlock.push(`- ${s.fullNameHe}`);
  }

  // Choose the strongest Latin handle for downstream search queries.
  const latinHandle = s.fullNameEn ?? Array.from(allVariants)[0] ?? s.fullNameHe;
  const searches: string[] = ['## הוראות חיפוש', 'בצע לפחות 6 חיפושים נפרדים. דוגמאות:'];
  let n = 1;
  searches.push(`${n++}. "${s.fullNameHe}" יחוס`);
  searches.push(`${n++}. "${latinHandle}" genealogy site:geni.com OR site:myheritage.com`);
  searches.push(`${n++}. "${latinHandle}" site:familysearch.org`);
  searches.push(`${n++}. "${latinHandle}" site:jewishgen.org`);
  searches.push(`${n++}. "${s.fullNameHe}" site:hebrewbooks.org OR site:otzar.org`);
  if (s.fatherNameEn || s.fatherNameHe) {
    const fatherHandle = s.fatherNameEn ?? s.fatherNameHe ?? '';
    searches.push(`${n++}. "${latinHandle}" "${fatherHandle}"`);
  }
  if (s.birthPlace) {
    searches.push(`${n++}. "${latinHandle}" ${s.birthPlace}`);
  }
  searches.push(`${n++}. "${latinHandle}" site:yadvashem.org`);

  const schemaBlock = `## פורמט תשובה — תאריכים לועזיים בלבד
החזר JSON תקין במבנה הבא (בלי code fences, בלי טקסט מסביב):
{
  "narrative": "סיכום ביוגרפי קצר בעברית, 4-8 משפטים",
  "structured": {
    "birthDate":  { "value": "YYYY-MM-DD או YYYY", "confidence": "high|medium|low" },
    "deathDate":  { "value": "YYYY-MM-DD או YYYY", "confidence": "high|medium|low" },
    "birthPlace": { "value": "עיר, מדינה", "confidence": "high|medium|low" },
    "deathPlace": { "value": "עיר, מדינה", "confidence": "high|medium|low" },
    "roles": ["תפקידים/תארים"],
    "children": ["שמות ילדים"],
    "siblings": ["שמות אחים ואחיות"],
    "spouse": "שם בן/בת זוג",
    "father": { "name": "Latin", "nameHe": "עברית", "birthDate": "YYYY-MM-DD", "deathDate": "YYYY-MM-DD", "deathPlace": "מקום", "fate": "Holocaust/natural/unknown" },
    "mother": { "name": "Latin", "nameHe": "עברית", "birthDate": "YYYY-MM-DD", "deathDate": "YYYY-MM-DD", "deathPlace": "מקום", "fate": "Holocaust/natural/unknown", "notes": "" },
    "sources": [ { "url": "https://...", "title": "כותרת", "snippet": "ציטוט קצר" } ],
    "notes": "הערות מתודולוגיות — מה נבדק ומה לא נמצא"
  }
}
שדות שלא נמצא להם מידע — השמט. אל תכתוב null או undefined.`;

  return [
    "חקור את האדם הבא והחזר JSON תקין כמוגדר במערכת.",
    '',
    facts.join('\n'),
    '',
    variantBlock.join('\n'),
    '',
    searches.join('\n'),
    '',
    schemaBlock,
  ].join('\n');
}

/**
 * Tolerant JSON extractor. The model sometimes wraps responses in ```json
 * fences, sometimes returns raw JSON, sometimes appends trailing prose. We
 * try strict parse, then fence-strip, then a greedy brace-balanced regex.
 * Returns null on total failure so the caller can decide whether to retry.
 */
function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Merge grounding URLs that Google attached to the response into
 * structured.sources. These are authoritative — the model actually opened
 * those pages — even if it forgot to echo them in its own JSON. Tolerates
 * a missing groundingMetadata chain (zero new sources, no throw).
 */
function mergeGroundingSources(structured: BioStructured, candidate: GeminiCandidate | undefined): void {
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  if (chunks.length === 0) return;

  const existing = new Set<string>(structured.sources.map((s) => s.url));
  for (const chunk of chunks) {
    const url = chunk?.web?.uri;
    if (!url || existing.has(url)) continue;
    existing.add(url);
    const title = chunk?.web?.title;
    structured.sources.push(title ? { url, title } : { url });
  }
}

function extractCandidateText(candidate: GeminiCandidate | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  return parts.map((p) => p?.text ?? '').join('');
}

function coerceStructured(parsed: unknown): BioStructured {
  if (parsed && typeof parsed === 'object' && 'structured' in parsed) {
    const s = (parsed as { structured?: Partial<BioStructured> }).structured;
    if (s && typeof s === 'object') {
      return { ...s, sources: Array.isArray(s.sources) ? s.sources : [] };
    }
  }
  return { sources: [] };
}

function extractNarrative(parsed: unknown): string | null {
  if (parsed && typeof parsed === 'object' && 'narrative' in parsed) {
    const n = (parsed as { narrative?: unknown }).narrative;
    if (typeof n === 'string' && n.trim()) return n.trim();
  }
  return null;
}

interface GenerateOpts {
  apiKey?: string;
  signal?: AbortSignal;
}

interface RequestBody {
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  tools: Array<{ google_search: Record<string, never> }>;
  systemInstruction: { parts: Array<{ text: string }> };
  generationConfig: {
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
  };
}

function buildRequestBody(userPrompt: string, maxOutputTokens: number): RequestBody {
  return {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: [{ google_search: {} }],
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      topK: 40,
      maxOutputTokens,
    },
  };
}

async function postGemini(
  apiKey: string,
  body: RequestBody,
  signal: AbortSignal | undefined,
): Promise<GeminiResponse> {
  // Dev-only payload dump. Gated by env so production logs stay clean.
  // No PII concerns — the operator already owns the data being logged.
  if (process.env.TOLDOTAY_DEBUG_AI === '1') {
    // eslint-disable-next-line no-console
    console.log('[gemini] request body:', JSON.stringify(body, null, 2));
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw Errors.internal(`Gemini request failed (${response.status})`);
  }

  return (await response.json()) as GeminiResponse;
}

/**
 * Generate a grounded Hebrew biography for the given subject.
 *
 * Accepts either a structured BioSubject (preferred) or a raw string prompt
 * (legacy / deprecated). The legacy overload wraps the string as
 * `{ fullNameHe: prompt }` and runs the same pipeline.
 *
 * Behaviour:
 *  - Always posts with maxOutputTokens=8192 first (Guarantee 1).
 *  - On MAX_TOKENS truncation with unparseable JSON, retries once with
 *    maxOutputTokens=12288 and a `שמור על narrative קצר.` suffix.
 *  - Merges Google's groundingChunks URIs into structured.sources even if
 *    the model didn't echo them in its JSON (Guarantee 7).
 *  - On empty / unparseable response with no grounding, returns a valid
 *    BioResult with the "לא נמצא מידע" fallback narrative rather than
 *    throwing (Guarantee 8).
 *
 * @deprecated The `string` overload is kept for backwards compatibility.
 *             New callers must pass a BioSubject.
 */
export async function generateGroundedHebrewBio(
  subject: BioSubject | string,
  opts: GenerateOpts = {},
): Promise<BioResult> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Errors.internal('GEMINI_API_KEY is not configured');
  }

  const resolvedSubject: BioSubject =
    typeof subject === 'string' ? { fullNameHe: subject } : subject;

  const userPrompt = buildUserPrompt(resolvedSubject);

  let body = buildRequestBody(userPrompt, PRIMARY_MAX_OUTPUT_TOKENS);
  let data = await postGemini(apiKey, body, opts.signal);
  let candidate = data.candidates?.[0];
  let text = extractCandidateText(candidate);
  let parsed = parseModelJson(text);

  if (parsed == null && candidate?.finishReason === 'MAX_TOKENS') {
    // One retry only, with a larger budget and a hint to compress.
    const retryPrompt = `${userPrompt}\nשמור על narrative קצר.`;
    body = buildRequestBody(retryPrompt, RETRY_MAX_OUTPUT_TOKENS);
    data = await postGemini(apiKey, body, opts.signal);
    candidate = data.candidates?.[0];
    text = extractCandidateText(candidate);
    parsed = parseModelJson(text);
  }

  const structured = coerceStructured(parsed);
  mergeGroundingSources(structured, candidate);

  const narrative =
    extractNarrative(parsed) ??
    (text.trim() ? text.trim() : 'לא נמצא מידע ציבורי מספק.');

  return { narrative, structured, raw: data };
}
