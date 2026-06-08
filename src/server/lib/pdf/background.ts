import 'server-only';

import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

import { getStyleToken } from './style-tokens';
import { parseVariantId } from './variants';
import {
  DESIGN_ASSETS_BUCKET,
  borderAssetPublicUrl,
  borderAssetStoragePath,
  ensureDesignAssetsBucket,
  objectExistsInDesignAssets,
  uploadToDesignAssets,
} from './storage-assets';
import type { EnsureBorderResult } from './types';

const FLASH_IMAGE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const MOTIF_BY_STYLE: Record<string, string> = {
  'heritage-sky':
    'Warm cream parchment heirloom poster with emerald and sage botanical branches in top corners, stylised tree roots at bottom centre, subtle vintage map fragments and location pins in margins.',
  'parchment-classic':
    'Sage-green botanical filigree on warm cream parchment, understated heirloom character.',
  'gold-royal':
    'Regal gold filigree and laurel motifs on ivory parchment, dignified royal tone.',
  'olive-mediterranean':
    'Olive-branch wreaths and Mediterranean tile-inspired corner patterns on soft parchment.',
};

const VARIATION_SUFFIX: Record<number, string> = {
  1: 'Variation A: symmetrical corner flourishes, delicate vine scrollwork, lighter filigree density.',
  2: 'Variation B: heavier corner medallions, bolder botanical motifs, slightly richer gold highlights.',
  3: 'Variation C: asymmetrical corner accents, flowing organic curves, softer aged-parchment texture grain.',
};

const SCENIC_EPOCH_VARIATIONS = [
  'Variation: warmer golden parchment wash, fuller olive foliage in the top-right corner, roots slightly wider at the base.',
  'Variation: softer cream tones, lighter sage branch motifs on the left, delicate parchment texture across the upper third.',
  'Variation: deeper emerald accents in corners, richer root texture at bottom centre, subtle warm glow upper-left.',
  'Variation: muted pastel wash, sparse minimalist corner leaves, thin elegant roots with more negative space.',
  'Variation: slightly richer watercolor saturation, asymmetric branch weight toward top-left, map fragments more visible in margins.',
  'Variation: pale horizon band across the middle, feathery leaf clusters in both top corners, grounded earthy root tones.',
] as const;

function scenicVariationForEpoch(epoch: string): string {
  if (!epoch || epoch === '0') return SCENIC_EPOCH_VARIATIONS[0];
  let hash = 0;
  for (let i = 0; i < epoch.length; i += 1) {
    hash = (hash * 31 + epoch.charCodeAt(i)) >>> 0;
  }
  return SCENIC_EPOCH_VARIATIONS[hash % SCENIC_EPOCH_VARIATIONS.length];
}

function borderVariationForEpoch(epoch: string, variantIndex: number): string {
  if (!epoch || epoch === '0') return VARIATION_SUFFIX[variantIndex] ?? VARIATION_SUFFIX[1];
  let hash = 0;
  for (let i = 0; i < epoch.length; i += 1) {
    hash = (hash * 37 + epoch.charCodeAt(i)) >>> 0;
  }
  const keys = Object.keys(VARIATION_SUFFIX).map(Number);
  const pick = keys[(hash + variantIndex) % keys.length] ?? 1;
  return VARIATION_SUFFIX[pick] ?? VARIATION_SUFFIX[1];
}

function buildScenicBackgroundPrompt(baseStyleId: string, epoch: string): string {
  const token = getStyleToken(baseStyleId);
  const motif = MOTIF_BY_STYLE[baseStyleId] ?? MOTIF_BY_STYLE['heritage-sky'];

  return [
    'Generate a full-page illustrated BACKGROUND for a vertical heirloom family-tree poster.',
    'Portrait orientation, tall aspect ratio (similar to A4 / letter portrait).',
    '',
    'Style DNA:',
    `- Palette: warm cream parchment (${token.backgroundColor}), emerald botanical accents (${token.connectorColor ?? token.accentColor})`,
    `- Motif: ${motif}`,
    '',
    'Composition requirements:',
    '- Decorative tree branches and leaves in the TOP LEFT and TOP RIGHT corners.',
    '- Stylised tree ROOTS / trunk emerging from the BOTTOM CENTRE (empty — no text on roots).',
    '- Faint vintage map paper fragments and small map pins in the side margins (decorative only).',
    '- Soft watercolor / gouache storybook illustration feel.',
    '- The CENTRE 70% of the page must stay relatively clear and light for overlaying family photos and Hebrew text.',
    '',
    'ABSOLUTE REQUIREMENTS:',
    '- Do NOT draw any text, letters, numbers, names, or writing in any language.',
    '- Do NOT draw portrait circles, photo frames, family charts, grids, or people faces.',
    '- No watermark, logo, or dates.',
    '',
    'This is a background layer only. The application overlays the family tree on top.',
    '',
    `Generation epoch g${epoch} — produce a DISTINCT visual design from prior epochs.`,
    scenicVariationForEpoch(epoch),
  ].join('\n');
}

function buildFlashImagePrompt(baseStyleId: string, variantIndex: number, epoch: string): string {
  const token = getStyleToken(baseStyleId);
  if (token.backgroundMode === 'scenic') {
    return buildScenicBackgroundPrompt(baseStyleId, epoch);
  }

  const motif = MOTIF_BY_STYLE[baseStyleId] ?? MOTIF_BY_STYLE['parchment-classic'];
  const suffix = borderVariationForEpoch(epoch, variantIndex);

  return [
    'Generate a decorative ornamental border frame for a printed heirloom family-tree poster, portrait orientation, tall aspect ratio.',
    '',
    'Style DNA for this generation:',
    `- Base style: ${token.labelHe}`,
    `- Background colour: ${token.backgroundColor}`,
    `- Accent / motif colour: ${token.accentColor}`,
    `- Motif character: ${motif}`,
    '',
    'Visual direction: aged parchment background in the specified palette, with an elegant hand-drawn ornamental border running around all four edges — subtle botanical vines, fine filigree, and corner flourishes in the accent colour and complementary warm gold tones. Traditional, timeless, understated. Leave the entire center area empty parchment with generous margins (at least 15% clear on each side).',
    '',
    'ABSOLUTE REQUIREMENTS — do not violate under any circumstances:',
    '- Do NOT draw any text, letters, words, numbers, calligraphy, or symbols that resemble writing in any language.',
    '- Do NOT draw any portrait frames, photo placeholders, circles, oval frames, cameos, silhouettes, or human figures. No faces. No people.',
    '- Do NOT draw a family tree, branches with name slots, charts, or grids.',
    '- The center MUST remain completely empty parchment. Only the four edges are decorated.',
    '- No watermark, no signature, no logo, no dates.',
    '',
    'This image is a background frame only. All names, photos, Hebrew text, and the family tree layout are added separately by our application on top of this frame.',
    '',
    `Generation epoch g${epoch} — produce a DISTINCT design from prior epochs.`,
    suffix,
  ].join('\n');
}

interface FlashImagePart {
  inlineData?: { mimeType?: string; data?: string };
}

interface FlashImageResponse {
  candidates?: Array<{
    content?: { parts?: FlashImagePart[] };
  }>;
}

/** Independent Flash Image call — not shared with bio or tier planner. */
async function generateFlashImageBorder(prompt: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(`${FLASH_IMAGE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as FlashImageResponse;
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const raw = part.inlineData?.data;
      if (raw) return Buffer.from(raw, 'base64');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ensure a decorative border exists for this variant.
 * Cache hit → return URL. Miss → Flash Image → upload. Failure → CSS fallback.
 */
export async function ensureBorderAsset(
  variantId: string,
  baseStyleId: string,
  variantIndex: number,
): Promise<EnsureBorderResult> {
  const storagePath = borderAssetStoragePath(variantId);
  const publicUrl = borderAssetPublicUrl(variantId);

  if (publicUrl && (await objectExistsInDesignAssets(storagePath))) {
    return { variantId, borderUrl: publicUrl, usedCssFallback: false };
  }

  if (!isSupabaseAdminConfigured()) {
    return { variantId, borderUrl: null, usedCssFallback: true };
  }

  const epoch = parseVariantId(variantId)?.epoch ?? String(Date.now());
  const prompt = buildFlashImagePrompt(baseStyleId, variantIndex, epoch);
  const imageBuffer = await generateFlashImageBorder(prompt);
  if (!imageBuffer) {
    return { variantId, borderUrl: null, usedCssFallback: true };
  }

  try {
    await ensureDesignAssetsBucket();
    await uploadToDesignAssets({
      path: storagePath,
      body: imageBuffer,
      contentType: 'image/png',
      upsert: true,
    });
    const url = borderAssetPublicUrl(variantId);
    return { variantId, borderUrl: url, usedCssFallback: !url };
  } catch {
    return { variantId, borderUrl: null, usedCssFallback: true };
  }
}
