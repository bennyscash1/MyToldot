import { generateStructuredJson } from '@/server/lib/gemini';

import { DEFAULT_STYLE_ID } from './style-tokens';
import type { TreeLayoutPlan, TreeSummary } from './types';

// The planner produces hierarchy only. It never sees PII beyond what the poster
// already shows, never uses web grounding, and is fully optional: any failure
// falls back to deterministicPlan() so PDF generation never hard-fails here.

const PLANNER_SYSTEM_INSTRUCTION = `You are a layout planner for a printed, heirloom-style family-tree poster.
You receive a compact JSON summary of one family tree and must assign every
person to exactly one visual tier that controls how large they are printed.

Tiers:
- "primary": the family head and their spouse(s). Largest cards, with biography.
- "secondary": the direct line near the head (parents, children, and their
  spouses; generation within +/-1 of the head). Medium cards.
- "compact": everyone else (distant ancestors and descendants). Small cards.

Hard rules:
1. Output STRICT JSON ONLY. No prose, no explanation, no markdown, no code fences.
2. Every person id from the input MUST appear in exactly one tier array, once.
3. Do not invent ids. Use only ids present in the input.
4. The head id (input.headId) MUST be in "primary".
5. Keep "primary" small (the head plus spouses; at most 3 people).
6. If the family is large (familySize > 40), prefer pushing distant relatives
   into "compact" so the poster stays legible.
7. Echo back the styleId you were given, unchanged.

Return exactly this shape:
{
  "styleId": "<the styleId from the input>",
  "tiers": { "primary": ["id"], "secondary": ["id"], "compact": ["id"] },
  "notes": "one short sentence of rationale (optional)"
}`;

/** Lightweight: planning is a small payload, so a short timeout is enough. */
const PLANNER_TIMEOUT_MS = 30_000;
const PLANNER_MAX_TOKENS = 4096;

/**
 * Deterministic hierarchy used when the AI is unavailable or returns invalid
 * JSON: head + spouse => primary, generation within +/-1 => secondary, rest =>
 * compact. Guarantees every person is tiered exactly once.
 */
export function deterministicPlan(summary: TreeSummary, styleId: string): TreeLayoutPlan {
  const primary: string[] = [];
  const secondary: string[] = [];
  const compact: string[] = [];

  for (const p of summary.persons) {
    if (p.relToHead === 'head' || p.relToHead === 'spouse') {
      primary.push(p.id);
    } else if (p.gen >= -1 && p.gen <= 1) {
      secondary.push(p.id);
    } else {
      compact.push(p.id);
    }
  }

  return {
    styleId,
    tiers: { primary, secondary, compact },
    notes: 'deterministic fallback',
  };
}

/**
 * Validate AI output against the summary: it must be an object with three tier
 * arrays, partition every person id exactly once, and include the head in
 * primary. Returns a normalised plan or null when invalid.
 */
function validatePlan(
  parsed: unknown,
  summary: TreeSummary,
  styleId: string,
): TreeLayoutPlan | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const tiers = (parsed as { tiers?: unknown }).tiers;
  if (!tiers || typeof tiers !== 'object') return null;

  const t = tiers as Record<string, unknown>;
  const primary = t.primary;
  const secondary = t.secondary;
  const compact = t.compact;
  if (!Array.isArray(primary) || !Array.isArray(secondary) || !Array.isArray(compact)) {
    return null;
  }

  const validIds = new Set(summary.persons.map((p) => p.id));
  const seen = new Set<string>();
  const clean = (arr: unknown[]): string[] => {
    const out: string[] = [];
    for (const raw of arr) {
      if (typeof raw !== 'string') continue;
      if (!validIds.has(raw) || seen.has(raw)) continue;
      seen.add(raw);
      out.push(raw);
    }
    return out;
  };

  const cleanPrimary = clean(primary);
  const cleanSecondary = clean(secondary);
  const cleanCompact = clean(compact);

  // Must cover every person exactly once (after dedupe across tiers).
  if (seen.size !== validIds.size) return null;
  // Head must be present in primary.
  if (summary.headId && !cleanPrimary.includes(summary.headId)) return null;

  const notes =
    typeof (parsed as { notes?: unknown }).notes === 'string'
      ? ((parsed as { notes: string }).notes)
      : undefined;

  return {
    styleId,
    tiers: { primary: cleanPrimary, secondary: cleanSecondary, compact: cleanCompact },
    notes,
  };
}

/**
 * Ask Gemini 2.5 Pro for a tier layout. Always resolves to a valid plan — on
 * any error, timeout, or invalid output it returns {@link deterministicPlan}.
 */
export async function planTreeLayout(
  summary: TreeSummary,
  styleId: string,
): Promise<TreeLayoutPlan> {
  const resolvedStyleId = styleId || DEFAULT_STYLE_ID;

  // Empty / single-person trees don't need the AI round-trip.
  if (summary.persons.length <= 1) {
    return deterministicPlan(summary, resolvedStyleId);
  }

  const userText = [
    `Plan the tier layout for this family tree. styleId = ${JSON.stringify(resolvedStyleId)}.`,
    '',
    JSON.stringify(summary),
    '',
    'Return strict JSON only, following the schema in your instructions.',
  ].join('\n');

  try {
    const result = await generateStructuredJson({
      systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      maxOutputTokens: PLANNER_MAX_TOKENS,
      timeoutMs: PLANNER_TIMEOUT_MS,
    });
    const valid = validatePlan(result.parsed, summary, resolvedStyleId);
    if (valid) return valid;
  } catch {
    // fall through to deterministic
  }

  return deterministicPlan(summary, resolvedStyleId);
}
