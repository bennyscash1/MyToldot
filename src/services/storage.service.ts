'use client';

import { profileImagePublicUrl } from '@/lib/supabase/public-url';
import type { ApiEnvelope } from '@/types/api';
import { ServiceError } from './api.client';

// ──────────────────────────────────────────────
// Storage Service — Browser-side
//
// Uploads are routed through our Next.js API endpoint
// (`POST /api/v1/uploads/profile-image`) which performs
// the actual upload using the Supabase service-role key.
//
// Why not call Supabase Storage directly from the browser?
//   In the anonymous MVP we don't have a logged-in user.
//   The browser Supabase client still tries to attach a JWT
//   from the auth cookie; if that cookie is empty/stale,
//   Supabase rejects the upload with `Invalid Compact JWS`.
//   Posting to our own server-side route avoids that path
//   entirely and bypasses RLS via the service-role client.
//
// Bucket convention (server-enforced):
//   profile-pictures/{treeId}/{personId}-{timestamp}.{ext}
// ──────────────────────────────────────────────

const UPLOAD_ENDPOINT = '/api/v1/uploads/profile-image';

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface UploadResult {
  /** Storage path relative to bucket root e.g. "tree-xyz/person-abc-1234.jpg" */
  path: string;
  /** Full public URL for immediate display in the UI */
  publicUrl: string;
}

/**
 * Client-side guardrail. The server enforces the same limits, but
 * checking up-front gives the user a fast, clear error.
 */
export function validateFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    throw new ServiceError(
      'UNSUPPORTED_FILE_TYPE',
      'Please upload a JPEG, PNG, or WebP image.',
      422,
    );
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new ServiceError(
      'FILE_TOO_LARGE',
      `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`,
      422,
    );
  }
}

export const storageService = {
  /**
   * Uploads a profile image via the server-side route.
   * Path pattern (built server-side): `{treeId}/{personId}-{timestamp}.{ext}`.
   *
   * Call AFTER person creation so the real personId is available, then pass
   * the returned `path` to `personsService.update({ profile_image })`.
   */
  async uploadProfileImage(
    file: File,
    treeId: string,
    personId: string,
  ): Promise<UploadResult> {
    validateFile(file);

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('treeId', treeId);
    form.append('personId', personId);

    let response: Response;
    try {
      response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        // No Content-Type header — the browser sets the multipart boundary.
        // No Authorization header either: the route uses service-role on the
        // server, which is the whole point of this refactor.
        credentials: 'include',
        body: form,
      });
    } catch (networkError) {
      console.error('[storageService] network error during upload:', networkError);
      throw new ServiceError(
        'UPLOAD_NETWORK_ERROR',
        'Could not reach the upload service. Check your connection and try again.',
        0,
      );
    }

    let envelope: ApiEnvelope<UploadResult>;
    try {
      envelope = (await response.json()) as ApiEnvelope<UploadResult>;
    } catch (parseError) {
      console.error('[storageService] could not parse upload response:', {
        status: response.status,
        parseError,
      });
      throw new ServiceError(
        'UPLOAD_INVALID_RESPONSE',
        `Upload service returned a non-JSON response (status ${response.status}).`,
        response.status,
      );
    }

    if (envelope.error !== null) {
      console.error('[storageService] upload failed:', {
        status: response.status,
        code: envelope.error.code,
        message: envelope.error.message,
      });
      throw new ServiceError(
        envelope.error.code,
        envelope.error.message,
        response.status,
      );
    }

    return envelope.data;
  },

  /**
   * Resolves a stored path to a full public URL (no network request).
   * Uses NEXT_PUBLIC_SUPABASE_URL — safe in client bundles.
   */
  getPublicUrl(storagePath: string): string {
    const url = profileImagePublicUrl(storagePath);
    if (!url) {
      throw new ServiceError(
        'SUPABASE_NOT_CONFIGURED',
        'Supabase URL is not configured.',
        503,
      );
    }
    return url;
  },
};
