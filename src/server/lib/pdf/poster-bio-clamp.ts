import type { PosterBioDepth } from './poster-bio-depth';

/** G1 (head + spouse): ~2 short paragraphs. */
export const POSTER_BIO_G1_MAX_CHARS = 700;

/** G2: 2–3 sentences. */
export const POSTER_BIO_G2_MAX_CHARS = 160;

function maxCharsForDepth(depth: 'full' | 'short'): number {
  return depth === 'full' ? POSTER_BIO_G1_MAX_CHARS : POSTER_BIO_G2_MAX_CHARS;
}

/** Clamp at sentence or word boundary — never mid-word. */
export function clampPosterBioText(text: string, depth: 'full' | 'short'): string {
  const max = maxCharsForDepth(depth);
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;

  const slice = trimmed.slice(0, max);
  const lastSentence = Math.max(
    slice.lastIndexOf('.'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf('?'),
    slice.lastIndexOf('…'),
  );
  if (lastSentence >= max * 0.55) {
    return slice.slice(0, lastSentence + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= max * 0.7) {
    return slice.slice(0, lastSpace).trim();
  }

  return slice.trim();
}

/** Clamp all paragraphs to the depth-specific character budget. */
export function clampPosterBioParagraphs(
  paragraphs: string[],
  depth: PosterBioDepth,
): string[] {
  if (depth === 'none') return [];
  const joined = paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
  if (!joined) return [];
  const clamped = clampPosterBioText(joined, depth);
  return clamped ? [clamped] : [];
}
