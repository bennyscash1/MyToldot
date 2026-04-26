'use server';

import { revalidatePath } from 'next/cache';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  type PersonInput,
  type PersonPatch,
} from '@/features/family-tree/schemas/person.schema';
import {
  createPersonInTree,
  updatePersonInTree,
  removePersonFromTree,
  type PersonDto,
} from '@/server/services/tree.service';

/** Creates a standalone person (no relationships). Used for the tree root, or prior to wiring. */
export async function createPersonAction(
  treeId: string,
  input: PersonInput,
): Promise<ActionResult<PersonDto>> {
  return withAction(async () => {
    const person = await createPersonInTree(treeId, input);
    revalidatePath('/[locale]/tree', 'page');
    return person;
  });
}

export async function updatePersonAction(
  treeId: string,
  personId: string,
  patch: PersonPatch,
): Promise<ActionResult<PersonDto>> {
  return withAction(async () => {
    const person = await updatePersonInTree(treeId, personId, patch);
    revalidatePath('/[locale]/tree', 'page');
    return person;
  });
}

/**
 * Deletes a person. All relationships referencing this person are cascaded by
 * the schema (onDelete: Cascade on both person1/person2 FKs).
 */
export async function deletePersonAction(
  treeId: string,
  personId: string,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const removed = await removePersonFromTree(treeId, personId);
    revalidatePath('/[locale]/tree', 'page');
    return removed;
  });
}
