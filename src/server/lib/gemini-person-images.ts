import { Errors } from '@/lib/api/errors';
import {
  ImageSearchResponseSchema,
  type ImageCandidate,
} from '@/features/family-tree/schemas/person-image-search.schema';
import { romanizeHebrewName } from '@/lib/images/hebrew-romanize';

const IMAGE_SEARCH_SYSTEM_INSTRUCTION = `אתה חוקר תמונות במערכת 'תולדותיי' — דמויות היסטוריות, משפחתיות, וגם דמויות ציבוריות מודרניות (זמרים, שחקנים, פוליטיקאים, רבנים).

המטרה: להחזיר כמה שיותר תמונות נכונות של אותו אדם ספציפי. עדיף 8–16 תמונות מאשר 1–2, אך אך ורק של האדם הנכון — לעולם אל תכלול תמונות של אדם אחר עם שם דומה.

כללי עבודה:
1. חפש תמונות ציבוריות בלבד — ויקיפדיה (he/en), Wikimedia Commons, Wikidata, אתרי ארכיון, מוזיאון, ספריות לאומיות, גנאלוגיה, אתרי מורשת.
2. עבור דמות ציבורית מוכרת — בצע חיפוש בוויקיפדיה העברית והאנגלית ובוויקינתונים (Wikidata) לפי השם, ומצא את תמונת ה-infobox ותמונות נוספות מקטגוריית Commons של אותו אדם.
3. קישורי תמונה מותרים (העתק במדויק מהתוצאות, אל תנחש hash):
   - https://upload.wikimedia.org/...  (קישור ישיר — הכי מועדף)
   - https://commons.wikimedia.org/wiki/Special:FilePath/<שם הקובץ>
   - https://he.wikipedia.org/wiki/File:<שם הקובץ>  או  https://en.wikipedia.org/wiki/File:<שם הקובץ>
   המערכת יודעת להמיר קישורי File: ו-Special:FilePath לקובץ הישיר, אז מותר להחזיר אותם.
4. אל תמציא URL. אם לא נמצאה תמונה אמיתית — החזר candidates: [].
5. חיפוש רב-לשוני: עברית + אנגלית + רומניזציה (יידיש/גרמנית/הונגרית/רוסית) של השם.
6. לכל תמונה: imageUrl, sourcePageUrl (דף המקור), sourceDomain, caption קצר בעברית, confidence.
7. confidence: high (מקור מהימן כמו ויקיפדיה/Commons + התאמה ודאית לאדם), medium (סביר), low (השערה / התאמה חלקית).
8. דחה: Shutterstock, Getty, iStock, Alamy, Depositphotos, 123RF, Unsplash, Pexels, Pixabay, Dreamstime, Freepik — תמונות סטוק/גנריות.
9. אם אינך בטוח שזה אותו אדם — סווג low או אל תכלול. דיוק חשוב יותר מכמות.
10. החזר JSON תקין בלבד — בלי markdown, בלי code fences, בלי טקסט לפני/אחרי.`;

export interface ImageSearchSubject {
  fullNameHe: string;
  fullNameEn?: string;
  gender?: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  parentNameHe?: string;
  parentRelation?: string;
}

interface GenerateImageSearchOpts {
  apiKey?: string;
  signal?: AbortSignal;
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface ImageSearchRequestBody {
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

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

const PRIMARY_MAX_OUTPUT_TOKENS = 8192;
const RETRY_MAX_OUTPUT_TOKENS = 12288;

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

function extractCandidateText(candidate: GeminiCandidate | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  return parts.map((p) => p?.text ?? '').join('');
}

function genderLabel(gender?: string): string {
  switch (gender) {
    case 'MALE':
      return 'זכר';
    case 'FEMALE':
      return 'נקבה';
    default:
      return 'לא ידוע';
  }
}

function buildImageSearchUserPrompt(subject: ImageSearchSubject, searchContext: string): string {
  // When the record has no Latin name, derive a best-effort romanization so the
  // model can also search English Wikipedia / Commons (e.g. "Meir Banai").
  const latinName =
    subject.fullNameEn?.trim() || romanizeHebrewName(subject.fullNameHe) || 'לא ידוע';

  return [
    'חפש עד 16 תמונות ציבוריות של האדם הבא. עדיף להחזיר כמה שיותר תמונות נכונות (8–16), אך רק של אותו אדם.',
    '',
    '=== נושא ===',
    `שם (עברית): ${subject.fullNameHe || 'לא ידוע'}`,
    `שם (Latin): ${latinName}`,
    `מין: ${genderLabel(subject.gender)}`,
    `נולד/ה: ${subject.birthDate || 'לא ידוע'}`,
    `נפטר/ה: ${subject.deathDate || 'לא ידוע'}`,
    `מקום לידה: ${subject.birthPlace || 'לא ידוע'}`,
    `הורה ידוע: ${subject.parentNameHe || 'לא ידוע'}${subject.parentRelation ? ` (${subject.parentRelation})` : ''}`,
    '',
    '=== הקשר חיפוש (ניתן לעריכה) ===',
    searchContext.trim() || subject.fullNameHe,
    '',
    '=== הוראות ===',
    '- בצע חיפושי google_search מרובים: בעברית ובאנגלית, כולל "ויקיפדיה", "Wikipedia", "Wikimedia Commons" ו-"Wikidata" יחד עם השם.',
    '- אם זו דמות ציבורית מוכרת — מצא את דף הוויקיפדיה שלה והחזר את תמונת ה-infobox + תמונות נוספות מקטגוריית Commons שלה.',
    '- החזר קישורי תמונה: upload.wikimedia.org או Special:FilePath או File: של ויקיפדיה (לא דפי HTML רגילים).',
    '- ודא שכל תמונה היא של אותו אדם בדיוק. אל תכלול אדם אחר עם שם דומה.',
    '- מקסימום 16 מועמדים, ממוינים לפי relevance (high קודם).',
    '',
    '=== פורmat JSON נדרש ===',
    `{
  "candidates": [
    {
      "imageUrl": "https://...",
      "sourcePageUrl": "https://...",
      "sourceDomain": "wikipedia.org",
      "caption": "תיאור קצר בעברית",
      "confidence": "high"
    }
  ]
}`,
  ].join('\n');
}

function buildImageSearchRequestBody(userPrompt: string, maxOutputTokens: number): ImageSearchRequestBody {
  return {
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: [{ google_search: {} }],
    systemInstruction: { parts: [{ text: IMAGE_SEARCH_SYSTEM_INSTRUCTION }] },
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      topK: 40,
      maxOutputTokens,
    },
  };
}

async function postGeminiImageSearch(
  apiKey: string,
  body: ImageSearchRequestBody,
  signal: AbortSignal | undefined,
): Promise<GeminiResponse> {
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

function parseImageCandidates(parsed: unknown): ImageCandidate[] {
  const result = ImageSearchResponseSchema.safeParse(parsed);
  if (result.success) return result.data.candidates;
  return [];
}

export async function generatePersonImageCandidates(
  subject: ImageSearchSubject,
  searchContext: string,
  opts: GenerateImageSearchOpts = {},
): Promise<ImageCandidate[]> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Errors.internal('GEMINI_API_KEY is not configured');
  }

  const userPrompt = buildImageSearchUserPrompt(subject, searchContext);

  let body = buildImageSearchRequestBody(userPrompt, PRIMARY_MAX_OUTPUT_TOKENS);
  let data = await postGeminiImageSearch(apiKey, body, opts.signal);
  let candidate = data.candidates?.[0];
  let text = extractCandidateText(candidate);
  let parsed = parseModelJson(text);
  let candidates = parseImageCandidates(parsed);

  if (candidates.length === 0 && (parsed == null || candidate?.finishReason === 'MAX_TOKENS')) {
    const retryPrompt = `${userPrompt}\n\nהחזר אך ורק JSON תקין לפי הסכמה. ללא markdown. ללא טקסט נוסף.`;
    body = buildImageSearchRequestBody(retryPrompt, RETRY_MAX_OUTPUT_TOKENS);
    data = await postGeminiImageSearch(apiKey, body, opts.signal);
    candidate = data.candidates?.[0];
    text = extractCandidateText(candidate);
    parsed = parseModelJson(text);
    candidates = parseImageCandidates(parsed);
  }

  return candidates;
}

export function buildDefaultImageSearchContext(subject: ImageSearchSubject): string {
  const parts = [subject.fullNameHe];
  if (subject.fullNameEn && subject.fullNameEn !== subject.fullNameHe) {
    parts.push(subject.fullNameEn);
  }
  if (subject.parentNameHe) {
    parts.push(`בן/בת ${subject.parentNameHe}`);
  }
  return parts.filter(Boolean).join(' — ');
}
