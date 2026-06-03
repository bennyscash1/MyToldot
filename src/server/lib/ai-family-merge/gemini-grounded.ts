import { Errors } from '@/lib/api/errors';
import {
  geminiContentsUserCharCount,
  structuredJsonTimeoutMs,
  type GeminiContent,
} from '@/server/lib/gemini';

import {
  AI_FAMILY_MERGE_GROUNDED_SYSTEM_PROMPT,
  AI_FAMILY_MERGE_RETRY_USER_PROMPT,
} from './prompt';
import { FamilyMergeProposalSchema } from './schema';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

const PRIMARY_MAX_OUTPUT_TOKENS = 8192;
const RETRY_MAX_OUTPUT_TOKENS = 16384;
const GROUNDED_TIMEOUT_EXTRA_MS = 90_000;
const STRUCTURED_LARGE_INPUT_CHARS = 1_200;

function groundedTimeoutMs(contents: GeminiContent[]): number {
  return structuredJsonTimeoutMs(geminiContentsUserCharCount(contents)) + GROUNDED_TIMEOUT_EXTRA_MS;
}

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
    systemInstruction: { parts: [{ text: AI_FAMILY_MERGE_GROUNDED_SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      topK: 40,
      maxOutputTokens,
    },
  };
}

function withTimeoutSignal(
  callerSignal: AbortSignal | undefined,
  ms: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, ms);
  const onAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onAbort);
    },
  };
}

async function postGemini(
  apiKey: string,
  body: RequestBody,
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

function tryParseProposal(text: string): unknown {
  const parsed = parseModelJson(text);
  if (parsed == null) return null;
  const result = FamilyMergeProposalSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export interface GenerateGroundedMergeResult {
  parsed: unknown;
  text: string;
  finishReason?: string;
}

export async function generateGroundedFamilyMerge(
  userPayload: string,
  opts?: { apiKey?: string; signal?: AbortSignal },
): Promise<GenerateGroundedMergeResult> {
  const apiKey = opts?.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Errors.internal('GEMINI_API_KEY is not configured');
  }

  const contents: RequestBody['contents'] = [{ role: 'user', parts: [{ text: userPayload }] }];
  const userChars = userPayload.length;
  const initialMaxTokens =
    userChars >= STRUCTURED_LARGE_INPUT_CHARS
      ? RETRY_MAX_OUTPUT_TOKENS
      : PRIMARY_MAX_OUTPUT_TOKENS;

  let body = buildRequestBody(contents, initialMaxTokens);
  const timeoutMs = groundedTimeoutMs([{ role: 'user', parts: [{ text: userPayload }] }]);
  const { signal, cleanup } = withTimeoutSignal(opts?.signal, timeoutMs);

  try {
    let data = await postGemini(apiKey, body, signal);
    let candidate = data.candidates?.[0];
    let text = extractCandidateText(candidate);
    let finishReason = candidate?.finishReason;
    let validated = tryParseProposal(text);

    if (validated == null && finishReason === 'MAX_TOKENS') {
      const retryContents: RequestBody['contents'] = [
        { role: 'user', parts: [{ text: userPayload }] },
        ...(text.trim() ? [{ role: 'model' as const, parts: [{ text }] }] : []),
        {
          role: 'user' as const,
          parts: [{ text: `${AI_FAMILY_MERGE_RETRY_USER_PROMPT}\nKeep newPeople concise.` }],
        },
      ];
      body = buildRequestBody(retryContents, RETRY_MAX_OUTPUT_TOKENS);
      data = await postGemini(apiKey, body, signal);
      candidate = data.candidates?.[0];
      text = extractCandidateText(candidate);
      finishReason = candidate?.finishReason;
      validated = tryParseProposal(text);
    }

    if (validated == null) {
      const retryContents: RequestBody['contents'] = [
        { role: 'user', parts: [{ text: userPayload }] },
        ...(text.trim() ? [{ role: 'model' as const, parts: [{ text }] }] : []),
        { role: 'user' as const, parts: [{ text: AI_FAMILY_MERGE_RETRY_USER_PROMPT }] },
      ];
      body = buildRequestBody(retryContents, PRIMARY_MAX_OUTPUT_TOKENS);
      data = await postGemini(apiKey, body, signal);
      candidate = data.candidates?.[0];
      text = extractCandidateText(candidate);
      finishReason = candidate?.finishReason;
      validated = tryParseProposal(text);
    }

    return { parsed: validated, text, finishReason };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === 'TimeoutError') {
      throw Errors.internal('The AI service took too long to respond. Please try again.');
    }
    throw err;
  } finally {
    cleanup();
  }
}
