import { randomUUID } from 'crypto';

import sharp from 'sharp';

import { Errors } from '@/lib/api/errors';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  ALLOWED_PHOTO_MIME,
  GALLERY_RESIZE,
  PERSON_PHOTO_BUCKET,
  type AllowedPhotoMime,
} from '@/lib/images/gallery-upload-constraints';

const EXT_FROM_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'jpg',
  'image/heif': 'jpg',
};

export type ProcessedGalleryImage = {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

/** Path inside `person-galleries`: `{treeId}/{personId}/{id}.jpg` */
export function buildPersonGalleryPath(
  treeId: string,
  personId: string,
  contentType?: string,
): string {
  const ext = contentType ? (EXT_FROM_TYPE[contentType] ?? 'jpg') : 'jpg';
  const id = randomUUID();
  return `${treeId}/${personId}/${id}.${ext}`;
}

export function isAllowedGalleryMime(type: string): type is AllowedPhotoMime {
  return (ALLOWED_PHOTO_MIME as readonly string[]).includes(type);
}

/** Resize to max edge 1600; HEIC/HEIF and most inputs become JPEG q82 unless PNG/WebP kept. */
export async function processGalleryUploadImage(
  input: Buffer,
  inputContentType: string,
): Promise<ProcessedGalleryImage> {
  const pipeline = sharp(input)
    .rotate()
    .resize(GALLERY_RESIZE.maxEdge, GALLERY_RESIZE.maxEdge, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  const normalized = inputContentType.toLowerCase();
  if (normalized === 'image/png') {
    const buffer = await pipeline
      .png({ compressionLevel: 9, effort: 7 })
      .toBuffer();
    return { buffer, contentType: 'image/png' };
  }
  if (normalized === 'image/webp') {
    const buffer = await pipeline.webp({ quality: GALLERY_RESIZE.quality }).toBuffer();
    return { buffer, contentType: 'image/webp' };
  }

  const buffer = await pipeline
    .jpeg({ quality: GALLERY_RESIZE.quality, mozjpeg: true })
    .toBuffer();
  return { buffer, contentType: 'image/jpeg' };
}

export async function uploadPersonGalleryAdmin(params: {
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<{ path: string; publicUrl: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(PERSON_PHOTO_BUCKET)
    .upload(params.path, params.body, {
      cacheControl: '3600',
      contentType: params.contentType,
      upsert: false,
    });

  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw Errors.internal(
        `Storage bucket "${PERSON_PHOTO_BUCKET}" is missing. Create it in Supabase (public) or run: npx dotenv-cli -e .env.local -- tsx --conditions=import scripts/ensure-person-galleries-bucket.ts`,
      );
    }
    throw Errors.internal(`Gallery upload failed: ${error.message}`);
  }

  const { data: urlData } = admin.storage
    .from(PERSON_PHOTO_BUCKET)
    .getPublicUrl(data.path);

  return { path: data.path, publicUrl: urlData.publicUrl };
}

/** Best-effort delete; logs and ignores failures. */
export async function deletePersonGalleryObject(path: string): Promise<void> {
  if (!path.trim()) return;
  try {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.storage.from(PERSON_PHOTO_BUCKET).remove([path]);
    if (error) {
      console.warn('[gallery-storage] delete failed:', path, error.message);
    }
  } catch (err) {
    console.warn('[gallery-storage] delete error:', path, err);
  }
}
