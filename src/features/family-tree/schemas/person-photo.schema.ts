import { z } from 'zod';

import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import { MAX_CAPTION_LENGTH } from '@/lib/images/gallery-upload-constraints';

export const PersonPhotoIdSchema = CuidSchema;

export const PersonPhotoCaptionSchema = z
  .string()
  .max(MAX_CAPTION_LENGTH)
  .transform((s) => {
    const t = s.trim();
    return t.length > 0 ? t : null;
  })
  .nullable()
  .optional();

export const AddPersonGalleryUploadSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
  caption: PersonPhotoCaptionSchema,
});

export const UpdatePersonPhotoCaptionSchema = z.object({
  photoId: PersonPhotoIdSchema,
  caption: z.string().max(MAX_CAPTION_LENGTH),
  shortCode: z.string().min(1),
});

export const RemovePersonPhotoSchema = z.object({
  photoId: PersonPhotoIdSchema,
  shortCode: z.string().min(1),
});

export const AddPersonPhotoUrlSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
  imageUrl: z.string().url().max(2048),
  caption: PersonPhotoCaptionSchema,
});

export const AddPersonPhotoUrlsBatchSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
  shortCode: z.string().min(1),
  photos: z
    .array(
      z.object({
        imageUrl: z.string().url().max(2048),
        caption: PersonPhotoCaptionSchema,
      }),
    )
    .min(1)
    .max(5),
});
