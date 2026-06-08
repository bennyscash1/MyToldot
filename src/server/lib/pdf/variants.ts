import { ensureBorderAsset } from './background';
import { BASE_STYLE_IDS } from './constants';
import type { PosterVariant } from './types';

/** Parse variant id using known base-style prefixes (ids contain dashes). */
export function parseVariantId(variantId: string): {
  baseStyleId: string;
  treeId: string;
  epoch: string;
  index: number;
} | null {
  for (const baseStyleId of BASE_STYLE_IDS) {
    const prefix = `${baseStyleId}--`;
    if (!variantId.startsWith(prefix)) continue;
    const rest = variantId.slice(prefix.length);
    const match = rest.match(/^(.+)--g([^-]+)--v(\d+)$/);
    if (!match) continue;
    return {
      baseStyleId,
      treeId: match[1],
      epoch: match[2],
      index: Number.parseInt(match[3], 10),
    };
  }
  return null;
}

/**
 * Build a stable variant id:
 *   {baseStyleId}--{treeId}--g{epoch}--v{n}
 *
 * Caching is per variant id. A new epoch (via "צור מחדש") mints fresh ids.
 */
export function buildVariantId(
  baseStyleId: string,
  treeId: string,
  epoch: string,
  index: number,
): string {
  return `${baseStyleId}--${treeId}--g${epoch}--v${index}`;
}

/** Short epoch token — unix seconds in base36 keeps ids compact. */
export function mintEpoch(): string {
  return Date.now().toString(36);
}

/** Ensure the single decorative border for one generation epoch. */
export async function ensurePosterVariant(
  treeId: string,
  baseStyleId: string,
  epoch: string,
): Promise<PosterVariant> {
  const variantId = buildVariantId(baseStyleId, treeId, epoch, 1);
  return ensureBorderAsset(variantId, baseStyleId, 1);
}
