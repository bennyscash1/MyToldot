import { DEFAULT_PERSON_IMAGE_SRC } from '@/lib/images/default-person';
import { normalizeExternalImageUrl } from '@/lib/images/normalize-external-image-url';
import { profileImagePublicUrl } from '@/lib/supabase/public-url';

export type PersonProfileImageFields = {
  profile_image_url?: string | null;
  profile_image?: string | null;
};

export function getPersonProfileImageUrl(
  person: PersonProfileImageFields,
  { fallback = DEFAULT_PERSON_IMAGE_SRC }: { fallback?: string } = {},
): string {
  if (person.profile_image_url?.trim()) {
    return normalizeExternalImageUrl(person.profile_image_url);
  }
  const supabaseUrl = profileImagePublicUrl(person.profile_image);
  if (supabaseUrl) return supabaseUrl;
  const legacy = person.profile_image?.trim();
  if (legacy?.startsWith('http')) return legacy;
  return fallback;
}
