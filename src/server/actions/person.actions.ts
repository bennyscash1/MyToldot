'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { requireTreeRole } from '@/lib/api/auth';
import { Errors } from '@/lib/api/errors';
import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  PersonInputSchema,
  PersonPatchSchema,
  CuidSchema,
  type PersonInput,
  type PersonPatch,
} from '@/features/family-tree/schemas/person.schema';

export interface PersonDto {
  id: string;
  first_name: string;
  last_name: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  birth_date: Date | null;
  death_date: Date | null;
}

const PERSON_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  gender: true,
  birth_date: true,
  death_date: true,
} as const;

/** Creates a standalone person (no relationships). Used for the tree root, or prior to wiring. */
export async function createPersonAction(
  treeId: string,
  input: PersonInput,
): Promise<ActionResult<PersonDto>> {
  return withAction(async () => {
    await requireTreeRole(treeId, 'EDITOR');
    const data = PersonInputSchema.parse(input);

    const person = await prisma.person.create({
      data: { ...data, tree_id: treeId },
      select: PERSON_SELECT,
    });

    revalidatePath(`/[locale]/(app)/tree/${treeId}`, 'page');
    return person;
  });
}

export async function updatePersonAction(
  treeId: string,
  personId: string,
  patch: PersonPatch,
): Promise<ActionResult<PersonDto>> {
  return withAction(async () => {
    await requireTreeRole(treeId, 'EDITOR');
    const id = CuidSchema.parse(personId);
    const data = PersonPatchSchema.parse(patch);

    // Guard: ensure the person actually belongs to this tree (prevents a
    // cross-tree write by crafting a foreign personId).
    const existing = await prisma.person.findFirst({
      where: { id, tree_id: treeId },
      select: { id: true },
    });
    if (!existing) throw Errors.notFound('Person');

    const person = await prisma.person.update({
      where: { id },
      data,
      select: PERSON_SELECT,
    });

    revalidatePath(`/[locale]/(app)/tree/${treeId}`, 'page');
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
    await requireTreeRole(treeId, 'EDITOR');
    const id = CuidSchema.parse(personId);

    const existing = await prisma.person.findFirst({
      where: { id, tree_id: treeId },
      select: { id: true },
    });
    if (!existing) throw Errors.notFound('Person');

    await prisma.person.delete({ where: { id } });

    revalidatePath(`/[locale]/(app)/tree/${treeId}`, 'page');
    return { id };
  });
}
