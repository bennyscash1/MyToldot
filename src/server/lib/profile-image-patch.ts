import { deleteProfileImage } from '@/lib/supabase/storage';
import { resolveExternalImageUrl } from '@/lib/images/validate-external-image-url';
import { Errors } from '@/lib/api/errors';

type ProfileImageExisting = {
  profile_image: string | null;
  profile_image_url: string | null;
};

type ProfileImagePatch = {
  profile_image?: string | null;
  profile_image_url?: string | null;
};

/**
 * Resolves mutually-exclusive profile_image / profile_image_url updates.
 * Deletes orphaned Supabase assets when switching to external URL or clearing.
 */
export async function applyProfileImagePatch(
  existing: ProfileImageExisting,
  patch: ProfileImagePatch,
): Promise<Partial<{ profile_image: string | null; profile_image_url: string | null }>> {
  const touchesStorage = patch.profile_image !== undefined;
  const touchesUrl = patch.profile_image_url !== undefined;
  if (!touchesStorage && !touchesUrl) return {};

  const nextStorage =
    patch.profile_image !== undefined ? patch.profile_image : existing.profile_image;
  const nextUrl =
    patch.profile_image_url !== undefined ? patch.profile_image_url : existing.profile_image_url;

  if (touchesStorage && patch.profile_image) {
    if (existing.profile_image && existing.profile_image !== patch.profile_image) {
      await deleteProfileImage(existing.profile_image);
    }
    return { profile_image: patch.profile_image, profile_image_url: null };
  }

  if (touchesUrl && patch.profile_image_url) {
    const resolved = await resolveExternalImageUrl(patch.profile_image_url);
    if (!resolved.ok) {
      throw Errors.unprocessable(resolved.reason);
    }
    if (existing.profile_image) {
      await deleteProfileImage(existing.profile_image);
    }
    return { profile_image: null, profile_image_url: resolved.url };
  }

  const clearing =
    (touchesStorage && patch.profile_image === null) ||
    (touchesUrl && patch.profile_image_url === null);

  if (clearing) {
    if (existing.profile_image) {
      await deleteProfileImage(existing.profile_image);
    }
    return { profile_image: null, profile_image_url: null };
  }

  if (touchesStorage && nextStorage) {
    return { profile_image: nextStorage, profile_image_url: null };
  }
  if (touchesUrl && nextUrl) {
    const resolved = await resolveExternalImageUrl(nextUrl);
    if (!resolved.ok) {
      throw Errors.unprocessable(resolved.reason);
    }
    if (existing.profile_image) {
      await deleteProfileImage(existing.profile_image);
    }
    return { profile_image: null, profile_image_url: resolved.url };
  }

  return {};
}
