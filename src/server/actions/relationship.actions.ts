'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma, RelationshipType } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireApprovedEditor, requireApprovedAdmin } from '@/lib/api/auth';
import { Errors } from '@/lib/api/errors';
import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  PersonInputSchema,
  CuidSchema,
} from '@/features/family-tree/schemas/person.schema';
import {
  addParentInTree,
  addChildInTree,
  addSpouseInTree,
  AddParentSchema,
  AddChildSchema,
  AddSpouseSchema,
  type AddedRelativeDto,
} from '@/server/services/tree.service';

// ────────────────────────────────────────────────────────────────
// Zod helpers
// ────────────────────────────────────────────────────────────────

const OptionalDate = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid date' })
  .optional()
  .nullable();

const LinkSpouseSchema = z.object({
  treeId: CuidSchema,
  person1Id: CuidSchema,
  person2Id: CuidSchema,
  start_date: OptionalDate,
});

const LinkParentChildSchema = z.object({
  treeId: CuidSchema,
  parentId: CuidSchema,
  childId: CuidSchema,
  adoptive: z.boolean().optional(),
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Asserts every id in `personIds` belongs to `treeId`. Throws NOT_FOUND otherwise. */
async function assertPersonsInTree(
  tx: Prisma.TransactionClient,
  treeId: string,
  personIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(personIds)];
  const count = await tx.person.count({
    where: { id: { in: uniqueIds }, tree_id: treeId },
  });
  if (count !== uniqueIds.length) throw Errors.notFound('Person');
}

/** The schema's unique index is on an ordered (person1, person2, type) tuple.
 * For *symmetric* types (SPOUSE, SIBLING, ENGAGED, DIVORCED) we must normalize
 * so that (A,B) and (B,A) don't both slip through. Lexicographic sort. */
function normalizeSymmetric(
  a: string,
  b: string,
  type: RelationshipType,
): [string, string] {
  const symmetric: RelationshipType[] = ['SPOUSE', 'SIBLING', 'ENGAGED', 'DIVORCED'];
  return symmetric.includes(type) && a > b ? [b, a] : [a, b];
}

function revalidateTree(): void {
  revalidatePath('/[locale]/tree', 'page');
}

// ────────────────────────────────────────────────────────────────
// Primitive link/unlink actions
// ────────────────────────────────────────────────────────────────

export async function linkSpouseAction(
  input: z.infer<typeof LinkSpouseSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const { treeId, person1Id, person2Id, start_date } = LinkSpouseSchema.parse(input);
    await requireApprovedEditor();
    if (person1Id === person2Id) throw Errors.badRequest('A person cannot be married to themselves');

    const rel = await prisma.$transaction(async (tx) => {
      await assertPersonsInTree(tx, treeId, [person1Id, person2Id]);
      const [p1, p2] = normalizeSymmetric(person1Id, person2Id, 'SPOUSE');
      return tx.relationship.create({
        data: {
          tree_id: treeId,
          relationship_type: 'SPOUSE',
          person1_id: p1,
          person2_id: p2,
          start_date: start_date ?? null,
        },
        select: { id: true },
      });
    });

    revalidateTree();
    return rel;
  });
}

export async function linkParentChildAction(
  input: z.infer<typeof LinkParentChildSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const { treeId, parentId, childId, adoptive } = LinkParentChildSchema.parse(input);
    await requireApprovedEditor();
    if (parentId === childId) throw Errors.badRequest('A person cannot be their own parent');

    const rel = await prisma.$transaction(async (tx) => {
      await assertPersonsInTree(tx, treeId, [parentId, childId]);
      return tx.relationship.create({
        data: {
          tree_id: treeId,
          relationship_type: adoptive ? 'ADOPTED_PARENT' : 'PARENT_CHILD',
          person1_id: parentId, // convention: person1 = parent
          person2_id: childId,
        },
        select: { id: true },
      });
    });

    revalidateTree();
    return rel;
  });
}

export async function deleteRelationshipAction(
  treeId: string,
  relationshipId: string,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    // Destructive: requires ADMIN.
    await requireApprovedAdmin();
    const id = CuidSchema.parse(relationshipId);

    const existing = await prisma.relationship.findFirst({
      where: { id, tree_id: treeId },
      select: { id: true },
    });
    if (!existing) throw Errors.notFound('Relationship');

    await prisma.relationship.delete({ where: { id } });
    revalidateTree();
    return { id };
  });
}

/** Used for e.g. stamping an `end_date` on a SPOUSE row when flipping to DIVORCED. */
const UpdateRelationshipPatchSchema = z.object({
  start_date: OptionalDate,
  end_date: OptionalDate,
  notes: z.string().max(2000).optional().nullable(),
  relationship_type: z
    .enum(['SPOUSE', 'PARENT_CHILD', 'SIBLING', 'ENGAGED', 'DIVORCED', 'ADOPTED_PARENT'])
    .optional(),
});

export async function updateRelationshipAction(
  treeId: string,
  relationshipId: string,
  patch: z.infer<typeof UpdateRelationshipPatchSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    await requireApprovedEditor();
    const id = CuidSchema.parse(relationshipId);
    const data = UpdateRelationshipPatchSchema.parse(patch);

    const existing = await prisma.relationship.findFirst({
      where: { id, tree_id: treeId },
      select: { id: true },
    });
    if (!existing) throw Errors.notFound('Relationship');

    const rel = await prisma.relationship.update({
      where: { id },
      data,
      select: { id: true },
    });
    revalidateTree();
    return rel;
  });
}

// ────────────────────────────────────────────────────────────────
// Composite "add relative" actions — called directly by "+" popovers
//
// Each one creates a Person AND the necessary relationship rows in a single
// transaction so a partial failure never leaves an orphan person on the canvas.
// ────────────────────────────────────────────────────────────────

export async function addSpouseAction(
  input: z.infer<typeof AddSpouseSchema>,
): Promise<ActionResult<AddedRelativeDto>> {
  return withAction(async () => {
    const result = await addSpouseInTree(input);
    revalidateTree();
    return result;
  });
}

export async function addParentAction(
  input: z.infer<typeof AddParentSchema>,
): Promise<ActionResult<AddedRelativeDto>> {
  return withAction(async () => {
    const result = await addParentInTree(input);
    revalidateTree();
    return result;
  });
}

export async function addChildAction(
  input: z.infer<typeof AddChildSchema>,
): Promise<ActionResult<AddedRelativeDto>> {
  return withAction(async () => {
    const result = await addChildInTree(input);
    revalidateTree();
    return result;
  });
}

const AddSiblingSchema = z.object({
  treeId: CuidSchema,
  existingSiblingId: CuidSchema,
  sibling: PersonInputSchema,
});

/** Siblings share parents. We look up the existing sibling's PARENT_CHILD rows
 * and create matching ones for the new person. If there are no parents yet,
 * we fall back to a loose SIBLING edge so the relation isn't lost. */
export async function addSiblingAction(
  input: z.infer<typeof AddSiblingSchema>,
): Promise<ActionResult<AddedRelativeDto>> {
  return withAction(async () => {
    const { treeId, existingSiblingId, sibling } = AddSiblingSchema.parse(input);
    await requireApprovedEditor();

    const result = await prisma.$transaction(async (tx) => {
      await assertPersonsInTree(tx, treeId, [existingSiblingId]);

      const parentRels = await tx.relationship.findMany({
        where: {
          tree_id: treeId,
          person2_id: existingSiblingId,
          relationship_type: { in: ['PARENT_CHILD', 'ADOPTED_PARENT'] },
        },
        select: { person1_id: true, relationship_type: true },
      });

      const newPerson = await tx.person.create({
        data: { ...sibling, tree_id: treeId },
        select: { id: true, first_name: true, last_name: true },
      });

      const relationship_ids: string[] = [];

      if (parentRels.length === 0) {
        const [a, b] = normalizeSymmetric(existingSiblingId, newPerson.id, 'SIBLING');
        const rel = await tx.relationship.create({
          data: {
            tree_id: treeId,
            relationship_type: 'SIBLING',
            person1_id: a,
            person2_id: b,
          },
          select: { id: true },
        });
        relationship_ids.push(rel.id);
      } else {
        const created = await Promise.all(
          parentRels.map((pr) =>
            tx.relationship.create({
              data: {
                tree_id: treeId,
                relationship_type: pr.relationship_type, // mirror adoptive vs bio
                person1_id: pr.person1_id,
                person2_id: newPerson.id,
              },
              select: { id: true },
            }),
          ),
        );
        relationship_ids.push(...created.map((r) => r.id));
      }

      return { person: newPerson, relationship_ids };
    });

    revalidateTree();
    return result;
  });
}
