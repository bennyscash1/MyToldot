import { z } from 'zod';

import type { TreeAboutImageItem } from '@/types/api';

export const TREE_ABOUT_IMAGES_MAX = 20;
export const TREE_ABOUT_CAPTION_MAX = 500;

export const treeAboutImageItemSchema = z.object({
  path: z.string().min(1).max(512),
  caption: z.string().max(TREE_ABOUT_CAPTION_MAX),
  order: z.number().int().min(0).max(999),
});

export const treeAboutImagesSchema = z
  .array(treeAboutImageItemSchema)
  .max(TREE_ABOUT_IMAGES_MAX);

export function pathBelongsToTreeAbout(treeId: string, path: string): boolean {
  return path.startsWith(`${treeId}/about/`);
}

/** Sort by order and re-index 0..n-1; trim captions. */
export function normalizeAboutImages(
  items: z.infer<typeof treeAboutImageItemSchema>[],
): TreeAboutImageItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order || a.path.localeCompare(b.path))
    .map((item, index) => ({
      path: item.path,
      caption: item.caption.trim(),
      order: index,
    }));
}

export function parseAboutImagesFromJson(raw: unknown): TreeAboutImageItem[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const parsed = treeAboutImagesSchema.safeParse(raw);
  if (!parsed.success) return [];
  return normalizeAboutImages(parsed.data);
}

export function extractPathsFromAboutJson(raw: unknown): string[] {
  if (raw == null || !Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const el of raw) {
    if (
      el &&
      typeof el === 'object' &&
      'path' in el &&
      typeof (el as { path: unknown }).path === 'string'
    ) {
      out.push((el as { path: string }).path);
    }
  }
  return out;
}
