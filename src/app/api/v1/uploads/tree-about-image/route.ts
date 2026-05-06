/**
 * POST /api/v1/uploads/tree-about-image
 *
 * Same bucket and upload helper as profile images; tree-scoped gallery (no person).
 * Images are resized/compressed on the server with the same max dimension as the
 * client `browser-image-compression` pipeline (`PROFILE_UPLOAD_MAX_DIMENSION`).
 *
 * Request: multipart/form-data — file, treeId
 * Response: { path, publicUrl } (envelope)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import { processProfileLikeUploadImage } from '@/lib/images/profileLikeServerResize';
import {
  ALLOWED_PROFILE_IMAGE_TYPES,
  PROFILE_IMAGE_MAX_BYTES,
  buildTreeAboutImagePath,
  uploadProfileImageAdmin,
} from '@/lib/supabase/storage';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';

const treeIdSchema = z.object({
  treeId: CuidSchema,
});

interface UploadResponseDto {
  path: string;
  publicUrl: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!isSupabaseAdminConfigured()) {
    console.error(
      '[uploads/tree-about-image] Missing SUPABASE_SERVICE_ROLE_KEY — server-side uploads are disabled.',
    );
    throw Errors.internal(
      'Server-side uploads are not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server env.',
    );
  }

  const contentTypeHeader = req.headers.get('content-type') ?? '';
  if (!contentTypeHeader.toLowerCase().startsWith('multipart/form-data')) {
    throw Errors.badRequest('Expected multipart/form-data request body.');
  }

  const form = await req.formData().catch(() => {
    throw Errors.badRequest('Could not parse multipart form body.');
  });

  const ids = treeIdSchema.safeParse({
    treeId: form.get('treeId'),
  });
  if (!ids.success) {
    const message = ids.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw Errors.unprocessable(message);
  }
  const { treeId } = ids.data;
  await requireTreeRole(treeId, 'EDITOR');

  const fileEntry = form.get('file');
  if (!(fileEntry instanceof Blob)) {
    throw Errors.badRequest('Missing `file` field in form data.');
  }

  const file = fileEntry as Blob & { name?: string; type: string; size: number };
  const originalName =
    typeof file.name === 'string' && file.name.length > 0 ? file.name : 'upload.bin';

  if (file.size === 0) {
    throw Errors.badRequest('Uploaded file is empty.');
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    throw Errors.unprocessable(
      `File too large. Maximum size is ${Math.round(
        PROFILE_IMAGE_MAX_BYTES / 1024 / 1024,
      )} MB.`,
    );
  }
  if (
    !ALLOWED_PROFILE_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_PROFILE_IMAGE_TYPES)[number],
    )
  ) {
    throw Errors.unprocessable(
      `Unsupported content-type "${file.type || 'unknown'}". Allowed: ${ALLOWED_PROFILE_IMAGE_TYPES.join(', ')}.`,
    );
  }

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  let processedBuffer: Buffer;
  let uploadContentType: string;
  try {
    const processed = await processProfileLikeUploadImage(rawBuffer, file.type);
    processedBuffer = processed.buffer;
    uploadContentType = processed.contentType;
  } catch (processError) {
    console.error('[uploads/tree-about-image] image processing failed', {
      treeId,
      contentType: file.type,
      error:
        processError instanceof Error
          ? { name: processError.name, message: processError.message }
          : processError,
    });
    throw Errors.unprocessable(
      'Could not process this image. Try a different JPEG, PNG, or WebP file.',
    );
  }

  const path = buildTreeAboutImagePath(treeId, originalName, uploadContentType);

  try {
    const result = await uploadProfileImageAdmin({
      path,
      body: processedBuffer,
      contentType: uploadContentType,
    });

    return ok<UploadResponseDto>(result, 201);
  } catch (uploadError) {
    console.error('[uploads/tree-about-image] upload failed', {
      treeId,
      path,
      contentType: uploadContentType,
      error:
        uploadError instanceof Error
          ? { name: uploadError.name, message: uploadError.message }
          : uploadError,
    });
    throw Errors.internal(
      uploadError instanceof Error
        ? uploadError.message
        : 'Tree about image upload failed.',
    );
  }
});
