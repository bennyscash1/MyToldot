'use server';

import { revalidatePath } from 'next/cache';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  RemovePersonPhotoSchema,
  UpdatePersonPhotoCaptionSchema,
} from '@/features/family-tree/schemas/person-photo.schema';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';
import {
  removePersonPhoto,
  updatePersonPhotoCaption,
} from '@/server/services/tree.service';

function revalidateTree(shortCode: string) {
  revalidatePath(`/[locale]/tree/${shortCode}`, 'page');
}

export async function removePersonPhotoAction(input: {
  photoId: string;
  shortCode: string;
}): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const { photoId, shortCode } = RemovePersonPhotoSchema.parse(input);
    const result = await removePersonPhoto(photoId);
    revalidateTree(shortCode);
    return result;
  });
}

export async function updatePersonPhotoCaptionAction(input: {
  photoId: string;
  caption: string;
  shortCode: string;
}): Promise<ActionResult<PersonPhotoDTO>> {
  return withAction(async () => {
    const { photoId, caption, shortCode } = UpdatePersonPhotoCaptionSchema.parse(input);
    const photo = await updatePersonPhotoCaption({ photoId, caption });
    revalidateTree(shortCode);
    return photo;
  });
}
