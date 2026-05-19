export const PERSON_PHOTO_BUCKET = 'person-galleries';
export const MAX_PHOTOS_PER_PERSON = 5;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const ALLOWED_PHOTO_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export const MAX_CAPTION_LENGTH = 200;
export const GALLERY_RESIZE = { maxEdge: 1600, quality: 82 } as const;

export type AllowedPhotoMime = (typeof ALLOWED_PHOTO_MIME)[number];
