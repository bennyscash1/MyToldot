import { normalizeExternalImageUrl } from '@/lib/images/normalize-external-image-url';
import { personGalleryPublicUrl } from '@/lib/supabase/public-url';

export type PersonPhotoUrlFields = {
  image_url?: string | null;
  storage_path?: string | null;
};

export function getPersonPhotoUrl(photo: PersonPhotoUrlFields): string | null {
  if (photo.image_url?.trim()) return normalizeExternalImageUrl(photo.image_url);
  return personGalleryPublicUrl(photo.storage_path);
}
