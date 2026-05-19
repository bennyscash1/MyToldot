/**
 * POST /api/v1/uploads/person-gallery
 *
 * Server-side person gallery upload (max 5 per person).
 * Multipart: file, treeId, personId, optional caption.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { MAX_CAPTION_LENGTH, MAX_PHOTO_BYTES } from '@/lib/images/gallery-upload-constraints';
import { isAllowedGalleryMime } from '@/lib/images/gallery-storage';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';
import { addPersonPhotoToTree } from '@/server/services/tree.service';

const uploadSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
  caption: z
    .string()
    .max(MAX_CAPTION_LENGTH)
    .optional()
    .transform((s) => {
      if (s === undefined) return null;
      const t = s.trim();
      return t.length > 0 ? t : null;
    }),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!isSupabaseAdminConfigured()) {
    throw Errors.internal(
      'Server-side uploads are not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server env.',
    );
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw Errors.badRequest('Expected multipart/form-data request body.');
  }

  const form = await req.formData().catch(() => {
    throw Errors.badRequest('Could not parse multipart form body.');
  });

  const parsed = uploadSchema.safeParse({
    treeId: form.get('treeId'),
    personId: form.get('personId'),
    caption: form.get('caption') ?? undefined,
  });
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw Errors.unprocessable(message);
  }

  const { treeId, personId, caption } = parsed.data;

  const fileEntry = form.get('file');
  if (!(fileEntry instanceof Blob)) {
    throw Errors.badRequest('Missing `file` field in form data.');
  }

  const file = fileEntry as Blob & { type: string; size: number };
  if (file.size === 0) {
    throw Errors.badRequest('Uploaded file is empty.');
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw Errors.unprocessable(
      `File too large. Maximum size is ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB.`,
    );
  }
  if (!isAllowedGalleryMime(file.type)) {
    throw Errors.unprocessable(
      `Unsupported content-type "${file.type || 'unknown'}".`,
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());

  const photo = await addPersonPhotoToTree({
    treeId,
    personId,
    buffer: rawBuffer,
    contentType: file.type,
    caption,
  });

  return ok<PersonPhotoDTO>(photo, 201);
});
