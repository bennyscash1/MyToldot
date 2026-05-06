import { getSupabaseAdminClient } from './admin';
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
// Why service-role for writes?
//   In the anonymous MVP we don't have a logged-in user, so an anon-key
//   client may attach a stale/empty JWT cookie which Supabase Storage
//   rejects with `Invalid Compact JWS`. The service-role client bypasses
//   RLS entirely and never touches a cookie, so writes are reliable.
//   Reads still go through the public URL (bucket is public) — no auth
//   needed there.
// ──────────────────────────────────────────────

export const STORAGE_BUCKET = 'profile-pictures';

/** File-validation contract used by the upload route handler. */
export const ALLOWED_PROFILE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_FROM_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Builds the canonical storage path for a person's profile image.
 * Does not perform any I/O.
 *
 * Path convention (inside the `profile-pictures` bucket):
 *   {treeId}/{personId}-{timestamp}.{ext}
 *
 * The full public URL becomes:
 *   {SUPABASE_URL}/storage/v1/object/public/profile-pictures/{path}
 */
export function buildProfileImagePath(
  treeId: string,
  personId: string,
  originalFilename: string,
  contentType?: string,
): string {
  const fromType = contentType ? EXT_FROM_TYPE[contentType] : undefined;
  const fromName = originalFilename.split('.').pop()?.toLowerCase();
  const ext = fromType ?? fromName ?? 'jpg';
  const timestamp = Date.now();
  return `${treeId}/${personId}-${timestamp}.${ext}`;
}

/**
 * Storage path for a tree About-page gallery image (same bucket as profiles).
 * Pattern: {treeId}/about/{timestamp}-{rand}.{ext}
 */
export function buildTreeAboutImagePath(
  treeId: string,
  originalFilename: string,
  contentType?: string,
): string {
  const fromType = contentType ? EXT_FROM_TYPE[contentType] : undefined;
  const fromName = originalFilename.split('.').pop()?.toLowerCase();
  const ext = fromType ?? fromName ?? 'jpg';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `${treeId}/about/${unique}.${ext}`;
}

/**
 * Uploads a profile image using the service-role client (bypasses RLS).
 * Throws a descriptive Error when the upload fails so callers can surface a
 * clear message instead of the underlying provider error.
 */
export async function uploadProfileImageAdmin(params: {
  path: string;
  body: ArrayBuffer | Buffer | Blob;
  contentType: string;
  upsert?: boolean;
}): Promise<{ path: string; publicUrl: string }> {
  const { path, body, contentType, upsert = true } = params;
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, body, {
      cacheControl: '3600',
      contentType,
      upsert,
    });

  if (error) {
    console.error('[storage] uploadProfileImageAdmin failed', {
      path,
      contentType,
      error: { name: error.name, message: error.message },
    });
    throw new Error(`Profile image upload failed: ${error.message}`);
  }

  const { data: publicData } = admin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data?.path ?? path);

  return { path: data?.path ?? path, publicUrl: publicData.publicUrl };
}

/**
 * Deletes a profile image from Supabase Storage.
 * Used when updating or deleting a person record.
 * Silently ignores missing files (idempotent).
 *
 * Prefers the service-role client (no JWT issues), falls back to the
 * cookie-aware client if the admin env vars are not configured.
 */
export async function deleteProfileImage(path: string): Promise<void> {
  try {
    const admin = getSupabaseAdminClient();
    await admin.storage.from(STORAGE_BUCKET).remove([path]);
    return;
  } catch (adminError) {
    // Service role not configured — fall back so existing flows keep working
    // in dev environments that haven't added the key yet.
    console.warn(
      '[storage] deleteProfileImage falling back to ssr client:',
      adminError instanceof Error ? adminError.message : adminError,
    );
  }

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
