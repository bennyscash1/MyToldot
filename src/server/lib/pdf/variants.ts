import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';

import { BASE_STYLE_IDS } from './constants';
import {
  ensureDesignAssetsBucket,
  getLatestFrameIndex,
  setLatestFrameIndex,
} from './storage-assets';

/** Number of minimalist CSS frame variants (v1–v4). */
export const FRAME_VARIANT_COUNT = 4;

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
 * v{n} selects a CSS frame variant (1–4). Epoch drives bio/layout cache.
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

/**
 * Resolve CSS frame index for this poster session.
 * regenerate=true → cycle 1→2→3→4→1. First visit defaults to 1.
 */
export async function resolveFrameIndex(
  baseStyleId: string,
  treeId: string,
  regenerate: boolean,
): Promise<number> {
  const prev = await getLatestFrameIndex(baseStyleId, treeId);
  const next = regenerate
    ? ((prev ?? 0) % FRAME_VARIANT_COUNT) + 1
    : (prev ?? 1);

  if (isSupabaseAdminConfigured()) {
    await ensureDesignAssetsBucket();
    await setLatestFrameIndex(baseStyleId, treeId, next);
  }

  return next;
}
