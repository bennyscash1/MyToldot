'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { requireAuthUser, requireTreeRole } from '@/lib/api/auth';
import { Errors } from '@/lib/api/errors';
import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  PersonInputSchema,
  CuidSchema,
} from '@/features/family-tree/schemas/person.schema';

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const CreateTreeSchema = z.object({
  name: z.string().trim().min(1, 'Tree name is required').max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  is_public: z.boolean().optional(),
  strict_lineage_enforcement: z.boolean().optional(),
  /** If provided, we create this person and set them as the tree's root. */
  root_person: PersonInputSchema.optional(),
});

const UpdateTreeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  is_public: z.boolean().optional(),
  strict_lineage_enforcement: z.boolean().optional(),
});

// ────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────

export interface CreatedTreeDto {
  id: string;
  name: string;
  root_person_id: string | null;
}

/**
 * Creates a tree, makes the caller an ADMIN member, and (optionally) seeds the
 * first Person + sets them as the tree's root. All in one transaction.
 */
export async function createTreeAction(
  input: z.infer<typeof CreateTreeSchema>,
): Promise<ActionResult<CreatedTreeDto>> {
  return withAction(async () => {
    const user = await requireAuthUser();
    const data = CreateTreeSchema.parse(input);

    // Mirror the Supabase user into our users table if missing (defensive —
    // signup normally handles this, but trees can be created later).
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: user.email!,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
    });

    const tree = await prisma.$transaction(async (tx) => {
      const created = await tx.tree.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          is_public: data.is_public ?? false,
          strict_lineage_enforcement: data.strict_lineage_enforcement ?? false,
        },
        select: { id: true, name: true },
      });

      await tx.treeMember.create({
        data: { tree_id: created.id, user_id: user.id, role: 'ADMIN' },
      });

      let rootPersonId: string | null = null;
      if (data.root_person) {
        const rootPerson = await tx.person.create({
          data: { ...data.root_person, tree_id: created.id },
          select: { id: true },
        });
        rootPersonId = rootPerson.id;
        await tx.tree.update({
          where: { id: created.id },
          data: { root_person_id: rootPersonId },
        });
        // Link the creator to their own seed person — the classic "this is me".
        await tx.treeMember.updateMany({
          where: { tree_id: created.id, user_id: user.id },
          data: { linked_person_id: rootPersonId },
        });
      }

      return { ...created, root_person_id: rootPersonId };
    });

    revalidatePath('/[locale]', 'layout');
    return tree;
  });
}

export async function updateTreeSettingsAction(
  treeId: string,
  patch: z.infer<typeof UpdateTreeSchema>,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    await requireTreeRole(treeId, 'ADMIN');
    const data = UpdateTreeSchema.parse(patch);

    const tree = await prisma.tree.update({
      where: { id: treeId },
      data,
      select: { id: true },
    });

    revalidatePath(`/[locale]/(app)/tree/${treeId}`, 'page');
    return tree;
  });
}

/** Changes the tree-wide default focal person (what every new visitor sees). */
export async function setRootPersonAction(
  treeId: string,
  personId: string,
): Promise<ActionResult<{ root_person_id: string }>> {
  return withAction(async () => {
    await requireTreeRole(treeId, 'ADMIN');
    const id = CuidSchema.parse(personId);

    const person = await prisma.person.findFirst({
      where: { id, tree_id: treeId },
      select: { id: true },
    });
    if (!person) throw Errors.notFound('Person');

    await prisma.tree.update({
      where: { id: treeId },
      data: { root_person_id: id },
    });

    revalidatePath(`/[locale]/(app)/tree/${treeId}`, 'page');
    return { root_person_id: id };
  });
}

/**
 * Persists the caller's "home person" for this tree (per-user focal).
 * Pass `null` to clear and fall back to the tree root.
 * This is the action behind MyHeritage's "Make focal person" when the user
 * wants the change to stick across sessions; runtime-only focus changes
 * should stay in URL state instead.
 */
export async function setUserLinkedPersonAction(
  treeId: string,
  personId: string | null,
): Promise<ActionResult<{ linked_person_id: string | null }>> {
  return withAction(async () => {
    const user = await requireTreeRole(treeId, 'VIEWER');

    if (personId !== null) {
      const id = CuidSchema.parse(personId);
      const person = await prisma.person.findFirst({
        where: { id, tree_id: treeId },
        select: { id: true },
      });
      if (!person) throw Errors.notFound('Person');
    }

    await prisma.treeMember.update({
      where: { tree_id_user_id: { tree_id: treeId, user_id: user.id } },
      data: { linked_person_id: personId },
    });

    revalidatePath(`/[locale]/(app)/tree/${treeId}`, 'page');
    return { linked_person_id: personId };
  });
}
