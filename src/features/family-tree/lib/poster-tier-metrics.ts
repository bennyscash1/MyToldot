import {
  POSTER_BIO_G1_MAX_CHARS,
  POSTER_BIO_G2_MAX_CHARS,
} from '@/server/lib/pdf/poster-bio-clamp';

/**
 * Rendered poster card dimensions — must match PosterPersonCard and ELK node
 * sizes fed in buildPosterTreeLayout (poster-only; canvas uses constants.ts).
 */
export type PosterCardLayout = 'column' | 'sideBio';

export interface PosterTierMetrics {
  width: number;
  /** Circular portrait diameter. */
  avatarSize: number;
  /** Y from card top to spouse-edge attachment (avatar centre). */
  spouseHandleY: number;
  nameBlockHeight: number;
  layout: PosterCardLayout;
}

export const POSTER_TIER_METRICS = {
  primary: {
    width: 340,
    avatarSize: 128,
    spouseHandleY: 64,
    nameBlockHeight: 44,
    layout: 'sideBio',
  },
  secondary: {
    width: 152,
    avatarSize: 100,
    spouseHandleY: 50,
    nameBlockHeight: 38,
    layout: 'column',
  },
  compact: {
    width: 104,
    avatarSize: 72,
    spouseHandleY: 36,
    nameBlockHeight: 32,
    layout: 'column',
  },
} as const satisfies Record<string, PosterTierMetrics>;

export type PosterTierKey = keyof typeof POSTER_TIER_METRICS;

/** Usable content width inside #pdf-root (1000px page − 90px side padding × 2). */
export const POSTER_CONTENT_WIDTH = 800;

/** Upper bound when upscaling small families to fill the page. */
export const POSTER_FIT_MAX_SCALE = 1.75;

export function posterTierMetrics(tier: PosterTierKey): PosterTierMetrics {
  return POSTER_TIER_METRICS[tier];
}

const BIO_LAYOUT = {
  primary: { fontSize: 13, lineHeight: 1.7, charsPerLine: 22, paraGap: 6, blockPadding: 16 },
  secondary: { fontSize: 10, lineHeight: 1.65, charsPerLine: 14, paraGap: 5, blockPadding: 10 },
  compact: { fontSize: 8.5, lineHeight: 1.6, charsPerLine: 11, paraGap: 3, blockPadding: 8 },
} as const;

function estimateTextLines(text: string, charsPerLine: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    const need = lineLen === 0 ? word.length : word.length + 1;
    if (lineLen + need > charsPerLine) {
      lines += 1;
      lineLen = word.length;
    } else {
      lineLen += need;
    }
  }
  return lines;
}

/** Card height including bio block — feeds ELK so rows do not overlap. */
export function estimatePosterCardHeight(
  tier: PosterTierKey,
  paragraphs: string[],
  relationshipLabel: string,
): number {
  const m = POSTER_TIER_METRICS[tier];
  const display = paragraphs.filter((p) => p.trim().length > 0);
  const headerH = m.avatarSize + m.nameBlockHeight + 12;

  if (display.length === 0) {
    return m.layout === 'sideBio' ? Math.max(headerH, m.avatarSize + 24) : headerH;
  }

  const cfg = BIO_LAYOUT[tier];
  const charBudget =
    tier === 'primary' ? POSTER_BIO_G1_MAX_CHARS : tier === 'secondary' ? POSTER_BIO_G2_MAX_CHARS : 0;
  const textForEstimate = display
    .join(' ')
    .slice(0, charBudget > 0 ? charBudget : undefined);
  let lines = relationshipLabel?.trim() ? 1 : 0;
  lines += estimateTextLines(textForEstimate, cfg.charsPerLine);
  const textHeight =
    lines * cfg.fontSize * cfg.lineHeight +
    Math.max(0, display.length - 1) * cfg.paraGap +
    cfg.blockPadding;

  if (m.layout === 'sideBio') {
    return Math.max(headerH, textHeight + 20);
  }
  return Math.ceil(headerH + textHeight);
}

/** Gap between generation rows after the tallest card in each row. */
export const POSTER_ROW_GAP = 72;
