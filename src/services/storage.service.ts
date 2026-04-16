'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ──────────────────────────────────────────────
// Storage Service — Browser-side
//
// Uploads files directly from the browser to
// Supabase Storage. This avoids routing large
// binary payloads through our Next.js API routes.
//
// Required Supabase bucket: "profile-pictures" (public)
// Required RLS policy for INSERT (run in Supabase SQL editor):
//
//   CREATE POLICY "Authenticated users can upload to their tree folder"
//   ON storage.objects FOR INSERT TO authenticated
//   WITH CHECK (
//     bucket_id = 'profile-pictures'
//   );
//
//   CREATE POLICY "Anyone can view profile pictures"
//   ON storage.objects FOR SELECT TO public
//   USING (bucket_id = 'profile-pictures');
// ──────────────────────────────────────────────

const BUCKET = 'profile-pictures';
const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface UploadResult {
  /** Storage path relative to bucket root, e.g. "tree-xyz/person-abc-1234.jpg" */
  path: string;
  /** Full public URL for immediate display in the UI */
  publicUrl: string;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new StorageError(
      `File type "${file.type}" is not supported. Please upload a JPEG, PNG, WebP, or GIF.`,
    );
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new StorageError(
      `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`,
    );
  }
}

export const storageService = {
  /**
   * Uploads a profile image directly to Supabase Storage.
   *
   * Path convention: `{treeId}/{personId}-{timestamp}.{ext}`
   *
   * Call this AFTER person creation so the real personId is used.
   * Pass the returned `path` to personsService.update().
   */
  async uploadProfileImage(
    file: File,
    treeId: string,
    personId: string,
  ): Promise<UploadResult> {
    validateFile(file);

    const supabase = createSupabaseBrowserClient();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${treeId}/${personId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true, // allow re-upload if user changes photo
        contentType: file.type,
      });

    if (error) throw new StorageError(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, publicUrl: data.publicUrl };
  },

  /** Resolves a stored path to a public URL without making an API call. */
  getPublicUrl(path: string): string {
    const supabase = createSupabaseBrowserClient();
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  },

  /** Removes a file from storage. Used when replacing a profile photo. */
  async remove(path: string): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    await supabase.storage.from(BUCKET).remove([path]);
  },
};
