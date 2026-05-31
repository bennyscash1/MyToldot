import { Errors } from '@/lib/api/errors';
import {
  ImageSearchResponseSchema,
  type ImageCandidate,
} from '@/features/family-tree/schemas/person-image-search.schema';

const IMAGE_SEARCH_SYSTEM_INSTRUCTION = `אתה חוקר תמונות היסטוריות במערכת 'תולדותיי', מומחה באיתור צילומים ציבוריים של דמויות יהודיות, רבנים, חסידים ודמויות גenealogיות ממזרח אירופה.

כללי עבודה:
1. חפש תמונות ציבוריות בלבד — ויקיפedia, אתרי ארכיון, מוזיאון, גenealogיה, אתרי מורשת.
2. החזר רק קישורים ישירים לקובץ תמונה — URL שמתחיל ב-upload.wikimedia.org או CDN דומה. לעולם אל תחזיר דפי HTML (commons.wikimedia.org/wiki/File:... אסור ב-imageUrl).
3. אל תמציא URL. אם לא נמצאה תמונה — החזר candidates: [].
4. חיפוש רב-לשוני: עברית + אנגלית + רומניזציה יידית/גרמנית/הונגרית.
5. לכל תמונה: sourcePageUrl (דף המקור), sourceDomain, caption קצר בעברית, confidence.
6. confidence: high (מקור מהימן + התאמה ברורה לשם), medium (סביר), low (השערה / התאמה חלקית).
7. העדף: ויקיפedia HE/EN, Yad Vashem, JewishGen, MyHeritage public, Geni public, nli.org.il, hebrewbooks.org.
8. דחה: Shutterstock, Getty, iStock, Alamy, Depositphotos, 123RF, Unsplash, Pexels, Pixabay, Dreamstime — תמונות סטוק/גנריות.
9. החזר JSON תקין בלבד — בלי markdown, בלי code fences, בלי טקסט לפני/אחרי.`;

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
  return [
    'חפש עד 8 תמונות ציבוריות של האדם הבא.',
    '',
    '=== נושא ===',
    `שם (עברית): ${subject.fullNameHe || 'לא ידוע'}`,
    `שם (Latin): ${subject.fullNameEn || 'לא ידוע'}`,
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
    '- בצע חיפושי google_search מרובים (עברית + אנגלית + varianti שם).',
    '- החזר רק URL ישירים לתמונות, לא דפי HTML.',
    '- מקסימום 8 מועמדים, ממוינים לפי relevance (high קודם).',
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
