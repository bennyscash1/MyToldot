/**
 * POST /api/v1/uploads/profile-image
 *
 * Server-side profile image upload.
 *
 * Why this exists:
 *   The browser Supabase client used to upload directly. In the anonymous MVP
 *   that path attaches a stale/empty bearer token from the auth cookie, which
 *   Supabase Storage rejects with `Invalid Compact JWS` (HTTP 403). Doing the
 *   upload server-side with the service-role client bypasses RLS and never
 *   sends a user JWT, so the upload is reliable.
 *
 * Contract:
 *   Request:  multipart/form-data
 *     - file:     the image (required, jpeg/png/webp, ≤ 5MB)
 *     - treeId:   tree the person belongs to (required)
 *     - personId: target person (required, must belong to treeId)
 *
 *   Response: { data: { path: string, publicUrl: string }, error: null }
 *     `path` is the storage path inside the `profile-pictures` bucket and is
 *     what should be persisted on `Person.profile_image`.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import {
  ALLOWED_PROFILE_IMAGE_TYPES,
  PROFILE_IMAGE_MAX_BYTES,
  buildProfileImagePath,
  uploadProfileImageAdmin,
} from '@/lib/supabase/storage';
import { isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';

const idsSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
});

interface UploadResponseDto {
  path: string;
  publicUrl: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!isSupabaseAdminConfigured()) {
    console.error(
      '[uploads/profile-image] Missing SUPABASE_SERVICE_ROLE_KEY — server-side uploads are disabled.',
    );
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

  const ids = idsSchema.safeParse({
    treeId: form.get('treeId'),
    personId: form.get('personId'),
  });
  if (!ids.success) {
    const message = ids.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw Errors.unprocessable(message);
  }
  const { treeId, personId } = ids.data;

  const fileEntry = form.get('file');
  if (!(fileEntry instanceof Blob)) {
    throw Errors.badRequest('Missing `file` field in form data.');
  }

  // `Blob` is the structural superset of `File`; `File.name` is only present
  // when the client sent one. Fall back to a stable default for path building.
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

  // Authorisation: confirm the person actually belongs to the supplied tree.
  // This is the single check that protects multi-tenant isolation while
  // requireTreeRole is bypassed for the MVP.
  const person = await prisma.person.findFirst({
    where: { id: personId, tree_id: treeId },
    select: { id: true },
  });
  if (!person) {
    throw Errors.notFound('Person');
  }

  const path = buildProfileImagePath(treeId, personId, originalName, file.type);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadProfileImageAdmin({
      path,
      body: buffer,
      contentType: file.type,
    });

    return ok<UploadResponseDto>(result, 201);
  } catch (uploadError) {
    console.error('[uploads/profile-image] upload failed', {
      treeId,
      personId,
      path,
      contentType: file.type,
      size: file.size,
      error:
        uploadError instanceof Error
          ? { name: uploadError.name, message: uploadError.message }
          : uploadError,
    });
    throw Errors.internal(
      uploadError instanceof Error
        ? uploadError.message
        : 'Profile image upload failed.',
    );
  }
});
