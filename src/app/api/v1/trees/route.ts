/**
 * /api/v1/trees
 *
 * GET  /api/v1/trees   - list trees the authenticated user belongs to
 * POST /api/v1/trees   - create a new tree + assign creator as ADMIN
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireAuthUser } from '@/lib/api/auth';
import type { CreateTreeBody, TreeDto } from '@/types/api';

// GET /api/v1/trees
// Returns every tree the authenticated user is a member of.

export const GET = withErrorHandler(async () => {
  const user = await requireAuthUser();

  const memberships = await prisma.treeMember.findMany({
    where: { user_id: user.id },
    select: {
      role: true,
      tree: {
        select: {
          id: true,
          name: true,
          description: true,
          is_public: true,
          strict_lineage_enforcement: true,
          about_text: true,
          main_surnames: true,
          created_at: true,
          updated_at: true,
          _count: { select: { persons: true } },
        },
      },
    },
    orderBy: { joined_at: 'asc' },
  });

  const trees = memberships.map(({ role, tree }) => ({
    ...tree,
    person_count: tree._count.persons,
    my_role: role,
    created_at: tree.created_at.toISOString(),
    updated_at: tree.updated_at.toISOString(),
  }));

  return ok(trees);
});

// POST /api/v1/trees
// Creates a tree and immediately adds the caller as ADMIN.
//
// IMPORTANT: We upsert the caller into public.users before inserting
// the TreeMember row. This self-heals the case where the Supabase Auth
// user exists but their mirror row in public.users was never created
// (e.g. the signup DB write was swallowed in dev, or the user was
// created directly via the Supabase dashboard).
// Without this upsert the FK on tree_members.user_id raises a 500.

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await requireAuthUser();
  const body: CreateTreeBody = await req.json();

  if (body.name == null || body.name.trim() === '') {
    throw Errors.badRequest('`name` is required');
  }

  // Atomic: upsert user mirror + create tree + add membership.
  const tree = await prisma.$transaction(async (tx) => {
    // 1. Ensure the caller has a row in public.users (FK requirement).
    await tx.user.upsert({
      where:  { id: user.id },
      update: { email: user.email ?? '' },
      create: {
        id:        user.id,
        email:     user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
    });

    // 2. Create the tree.
    const created = await tx.tree.create({
      data: {
        name:        body.name.trim(),
        description: body.description?.trim() ?? null,
        is_public:   body.is_public ?? false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        is_public: true,
        strict_lineage_enforcement: true,
        about_text: true,
        main_surnames: true,
        created_at: true,
        updated_at: true,
      },
    });

    // 3. Add the creator as ADMIN.
    await tx.treeMember.create({
      data: {
        tree_id: created.id,
        user_id: user.id,
        role:    'ADMIN',
      },
    });

    return created;
  }).catch((error) => {
    console.error('[TREES_API_ERROR] POST /api/v1/trees failed:', error);
    throw error;
  });

  return ok<TreeDto>(
    {
      ...tree,
      created_at: tree.created_at.toISOString(),
      updated_at: tree.updated_at.toISOString(),
    } as TreeDto,
    201,
  );
});
