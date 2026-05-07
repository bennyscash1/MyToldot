'use server';

import { revalidatePath } from 'next/cache';
import { RelationshipType, TreeMemberRole } from '@prisma/client';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  CuidSchema,
  type PersonInput,
  type PersonPatch,
} from '@/features/family-tree/schemas/person.schema';
import { prisma } from '@/lib/prisma';
import { requireTreeRole } from '@/lib/api/auth';
import { Errors } from '@/lib/api/errors';
import {
  createPersonInTree,
  updatePersonInTree,
  removePersonFromTree,
  type PersonDto,
} from '@/server/services/tree.service';
import { generateGroundedHebrewBio } from '@/server/lib/gemini';

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

function fullNameForPrompt(person: {
  first_name: string;
  last_name: string | null;
  first_name_he: string | null;
  last_name_he: string | null;
}): string {
  const hebrew = [person.first_name_he, person.last_name_he].filter(Boolean).join(' ').trim();
  if (hebrew) return hebrew;
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

export async function fetchAiBiographyAction(
  personId: string,
): Promise<ActionResult<{ text: string }>> {
  return withAction(async () => {
    const validatedId = CuidSchema.parse(personId);
    if (!process.env.GEMINI_API_KEY) {
      throw Errors.internal('GEMINI_API_KEY is not configured');
    }

    const person = await prisma.person.findUnique({
      where: { id: validatedId },
      include: {
        relationships_as_person2: {
          where: {
            relationship_type: {
              in: [RelationshipType.PARENT_CHILD, RelationshipType.ADOPTED_PARENT],
            },
          },
          include: {
            person1: {
              select: {
                first_name: true,
                last_name: true,
                first_name_he: true,
                last_name_he: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!person) {
      throw Errors.notFound('Person');
    }

    await requireTreeRole(person.tree_id, TreeMemberRole.EDITOR);

    const father = person.relationships_as_person2.find((rel) => rel.person1.gender === 'MALE')?.person1 ?? null;
    const mother = person.relationships_as_person2.find((rel) => rel.person1.gender === 'FEMALE')?.person1 ?? null;
    const parent = father ?? mother;

    const personName = fullNameForPrompt(person);
    const parentName = parent ? fullNameForPrompt(parent) : '';
    const childLabel = person.gender === 'MALE' ? 'הבן' : person.gender === 'FEMALE' ? 'הבת' : 'הבן/הבת';
    const parentClause = parent ? `, ${childLabel} של ${parentName}` : '';

    const prompt = `תביא כל מה שאתה מוצא על ${personName}${parentClause}.

חפש ב:
- ויקיפדיה בעברית ובאנגלית
- אתרי גנאולוגיה (MyHeritage, Geni, JewishGen)
- ספרי רבנים וספרי יוחסין דיגיטליים

כלול: תאריכי לידה ופטירה, מקום מגורים, תפקידים ותארים, ילדים ידועים, אחים.
אם המידע מוגבל — ציין זאת בבירור.`;

    const text = await generateGroundedHebrewBio(prompt);
    return { text };
  });
}
