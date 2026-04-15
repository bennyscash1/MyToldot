/**
 * BOILERPLATE — /api/v1/trees
 *
 * GET  /api/v1/trees      → list all public trees (Phase 3 will scope to authed user)
 * POST /api/v1/trees      → create a new tree
 *
 * This file demonstrates the full pattern every future route will follow:
 *  1. Import ONLY from lib/prisma, lib/api/*, types/api — never from components/
 *  2. Use withErrorHandler() so no route ever forgets a try/catch
 *  3. Return ok() / err() for a consistent JSON envelope
 *  4. Validate request body before touching the DB (Zod arrives in Phase 4)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import type { CreateTreeBody, TreeDto } from '@/types/api';

// ─────────────────────────────────────────────
// GET /api/v1/trees
// ─────────────────────────────────────────────

export const GET = withErrorHandler(async () => {
  const trees = await prisma.tree.findMany({
    // Phase 3: replace `where: {}` with `where: { members: { some: { user_id: session.user.id } } }`
    where: { is_public: true },
    select: {
      id: true,
      name: true,
      description: true,
      is_public: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { created_at: 'desc' },
  });

  // Map to DTO — dates serialized to ISO strings by JSON.stringify automatically,
  // but we cast the type explicitly so TypeScript stays happy.
  return ok<TreeDto[]>(trees as unknown as TreeDto[]);
});

// ─────────────────────────────────────────────
// POST /api/v1/trees
// ─────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: CreateTreeBody = await req.json();

  // Basic validation (Phase 4 replaces this with a Zod schema)
  if (!body.name?.trim()) {
    throw Errors.badRequest('`name` is required');
  }

  const tree = await prisma.tree.create({
    data: {
      name: body.name.trim(),
      description: body.description ?? null,
      is_public: body.is_public ?? false,
    },
    select: {
      id: true,
      name: true,
      description: true,
      is_public: true,
      created_at: true,
      updated_at: true,
    },
  });

  return ok<TreeDto>(tree as unknown as TreeDto, 201);
});
