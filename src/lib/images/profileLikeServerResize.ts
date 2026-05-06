import sharp from 'sharp';

import { PROFILE_UPLOAD_MAX_DIMENSION } from '@/lib/images/profile-upload-constraints';

export type ProcessedUploadImage = {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
};

/**
 * Server-side resize/compress aligned with the browser pipeline in
 * `storage.service.ts` (`maxWidthOrHeight: PROFILE_UPLOAD_MAX_DIMENSION`, same MIME set).
 * Uses `fit: 'inside'` so the longest edge is at most 500px (no enlargement).
 */
export async function processProfileLikeUploadImage(
  input: Buffer,
  inputContentType: string,
): Promise<ProcessedUploadImage> {
  const pipeline = sharp(input).rotate().resize(PROFILE_UPLOAD_MAX_DIMENSION, PROFILE_UPLOAD_MAX_DIMENSION, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (inputContentType === 'image/webp') {
    const buffer = await pipeline.webp({ quality: 82 }).toBuffer();
    return { buffer, contentType: 'image/webp' };
  }

  if (inputContentType === 'image/png') {
    const buffer = await pipeline.png({ compressionLevel: 9, effort: 7 }).toBuffer();
    return { buffer, contentType: 'image/png' };
  }

  const buffer = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return { buffer, contentType: 'image/jpeg' };
}
