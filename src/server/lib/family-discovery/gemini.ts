import { Errors } from '@/lib/api/errors';

import {
  FAMILY_DISCOVERY_RETRY_USER_PROMPT,
  FAMILY_DISCOVERY_SYSTEM_INSTRUCTION,
  buildFamilyDiscoveryUserPrompt,
} from './prompt';
import { FamilyDiscoveryResponseSchema } from './schema';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

const PRIMARY_MAX_OUTPUT_TOKENS = 8192;
const RETRY_MAX_OUTPUT_TOKENS = 12288;

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

interface RequestBody {
  contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>;
  tools: Array<{ google_search: Record<string, never> }>;
  systemInstruction: { parts: GeminiPart[] };
  generationConfig: {
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
  };
}

export interface DiscoverFamilyMembersOpts {
  treeSummaryBlock: string;
  apiKey?: string;
  signal?: AbortSignal;
}

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

function buildRequestBody(
  contents: RequestBody['contents'],
  maxOutputTokens: number,
): RequestBody {
  return {
    contents,
    tools: [{ google_search: {} }],
    systemInstruction: { parts: [{ text: FAMILY_DISCOVERY_SYSTEM_INSTRUCTION }] },
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
  if (process.env.TOLDOTAY_DEBUG_AI === '1') {
    // eslint-disable-next-line no-console
    console.log('[gemini:family-discovery] request body:', JSON.stringify(body, null, 2));
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

function tryParseProposals(text: string) {
  const parsed = parseModelJson(text);
  if (parsed == null) return null;
  const result = FamilyDiscoveryResponseSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

/**
 * Calls Gemini 2.5 Pro with google_search grounding to discover missing family members.
 * Retries once on MAX_TOKENS truncation, and once more with a stricter JSON reminder on parse failure.
 */
export async function discoverFamilyMembersWithGemini(
  opts: DiscoverFamilyMembersOpts,
): Promise<{ proposals: ReturnType<typeof FamilyDiscoveryResponseSchema.parse>['proposals'] }> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Errors.internal('GEMINI_API_KEY is not configured');
  }

  const userPrompt = buildFamilyDiscoveryUserPrompt(opts.treeSummaryBlock);
  let contents: RequestBody['contents'] = [{ role: 'user', parts: [{ text: userPrompt }] }];

  let body = buildRequestBody(contents, PRIMARY_MAX_OUTPUT_TOKENS);
  let data = await postGemini(apiKey, body, opts.signal);
  let candidate = data.candidates?.[0];
  let text = extractCandidateText(candidate);
  let validated = tryParseProposals(text);

  if (validated == null && candidate?.finishReason === 'MAX_TOKENS') {
    contents = [
      { role: 'user', parts: [{ text: userPrompt }] },
      { role: 'model', parts: [{ text: text || '{}' }] },
      {
        role: 'user',
        parts: [{ text: `${FAMILY_DISCOVERY_RETRY_USER_PROMPT}\nשמור על מערך proposals קצר.` }],
      },
    ];
    body = buildRequestBody(contents, RETRY_MAX_OUTPUT_TOKENS);
    data = await postGemini(apiKey, body, opts.signal);
    candidate = data.candidates?.[0];
    text = extractCandidateText(candidate);
    validated = tryParseProposals(text);
  }

  if (validated == null) {
    contents = [
      { role: 'user', parts: [{ text: userPrompt }] },
      ...(text.trim()
        ? [{ role: 'model' as const, parts: [{ text }] }]
        : []),
      { role: 'user', parts: [{ text: FAMILY_DISCOVERY_RETRY_USER_PROMPT }] },
    ];
    body = buildRequestBody(contents, PRIMARY_MAX_OUTPUT_TOKENS);
    data = await postGemini(apiKey, body, opts.signal);
    candidate = data.candidates?.[0];
    text = extractCandidateText(candidate);
    validated = tryParseProposals(text);
  }

  if (validated == null) {
    throw Errors.internal('AI response could not be parsed as valid family discovery JSON');
  }

  return validated;
}
