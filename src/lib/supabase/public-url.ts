import { PERSON_PHOTO_BUCKET } from '@/lib/images/gallery-upload-constraints';

/**
 * Builds a public URL for a file in the `profile-pictures` bucket from its storage path.
 * Safe to use in Client Components (uses only NEXT_PUBLIC_* env).
 */
export function profileImagePublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/profile-pictures/${path}`;
}

/** Public URL for a person gallery image in the `person-galleries` bucket. */
export function personGalleryPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${PERSON_PHOTO_BUCKET}/${path}`;
}
