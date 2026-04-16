import { createSupabaseServerClient } from './server';

// ──────────────────────────────────────────────
// Supabase Storage — Server-side Utilities
//
// Use this from Route Handlers only.
// For browser-side uploads from Client Components,
// see src/services/storage.service.ts.
//
// Bucket name: "profile-pictures"
// Path convention: {treeId}/{personId}-{timestamp}.{ext}
//
// Required Supabase bucket settings (set in dashboard):
//   • Public bucket: YES (so profile images can be displayed without auth)
//   • RLS policy — INSERT: authenticated users can upload to their tree's folder
//     CREATE POLICY "tree members can upload"
//     ON storage.objects FOR INSERT TO authenticated
//     WITH CHECK (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = <tree_id>);
// ──────────────────────────────────────────────

export const STORAGE_BUCKET = 'profile-pictures';

/**
 * Builds the canonical storage path for a person's profile image.
 * Does not perform any I/O.
 */
export function buildProfileImagePath(
  treeId: string,
  personId: string,
  originalFilename: string,
): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const timestamp = Date.now();
  return `${treeId}/${personId}-${timestamp}.${ext}`;
}

/**
 * Deletes a profile image from Supabase Storage.
 * Used when updating or deleting a person record.
 * Silently ignores missing files (idempotent).
 */
export async function deleteProfileImage(path: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  // Errors are intentionally swallowed — a missing image is not fatal.
}

/**
 * Returns the public URL for a stored profile image path.
 * The bucket must be public for this URL to be accessible.
 */
export async function getProfileImageUrl(path: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
