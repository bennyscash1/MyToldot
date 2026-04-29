/**
 * /api/v1/trees
 *
 * GET  /api/v1/trees   - list trees the authenticated user belongs to
 * POST /api/v1/trees   - create a new tree + assign creator as ADMIN
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireAuthUser } from '@/lib/api/auth';
import { generateUniqueTreeSlug } from '@/lib/tree/slug';
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
          slug: true,
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

  let tree: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    is_public: boolean;
    strict_lineage_enforcement: boolean;
    about_text: string | null;
    main_surnames: string[];
    created_at: Date;
    updated_at: Date;
  } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      tree = await prisma.$transaction(async (tx) => {
        await tx.user.upsert({
          where:  { id: user.id },
          update: { email: user.email ?? '' },
          create: {
            id:        user.id,
            email:     user.email ?? '',
            full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
          },
        });

        const slug = await generateUniqueTreeSlug(tx);
        const created = await tx.tree.create({
          data: {
            slug,
            name:        body.name.trim(),
            description: body.description?.trim() ?? null,
            is_public:   body.is_public ?? false,
          },
          select: {
            id: true,
            slug: true,
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

        await tx.treeMember.create({
          data: {
            tree_id: created.id,
            user_id: user.id,
            role:    'ADMIN',
          },
        });

        return created;
      });
      break;
    } catch (error) {
      const isSlugCollision =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target).includes('slug');
      if (!isSlugCollision || attempt === 4) {
        console.error('[TREES_API_ERROR] POST /api/v1/trees failed:', error);
        throw error;
      }
    }
  }

  if (!tree) throw Errors.internal('Tree creation failed after slug retries');

  return ok<TreeDto>(
    {
      ...tree,
      created_at: tree.created_at.toISOString(),
      updated_at: tree.updated_at.toISOString(),
    } as TreeDto,
    201,
  );
});
