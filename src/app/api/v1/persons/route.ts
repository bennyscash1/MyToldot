/**
 * /api/v1/persons
 *
 * GET  ?tree_id=xxx   → list all persons in a tree (requires VIEWER+)
 * POST               → create a new person      (requires EDITOR+)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import { isStrictLineageActive } from '@/lib/api/lineage';
import type { CreatePersonBody, PersonDto } from '@/types/api';

// ─────────────────────────────────────────────
// Shared Prisma select — always return the same
// shape so every handler stays DRY.
// ─────────────────────────────────────────────
const PERSON_SELECT = {
  id: true,
  tree_id: true,
  first_name: true,
  last_name: true,
  maiden_name: true,
  gender: true,
  birth_date: true,
  death_date: true,
  birth_place: true,
  bio: true,
  profile_image: true,
  first_name_he: true,
  last_name_he: true,
  created_at: true,
  updated_at: true,
} as const;

// ─────────────────────────────────────────────
// GET /api/v1/persons?tree_id=xxx
// ─────────────────────────────────────────────
export const GET = withErrorHandler(async (req: NextRequest) => {
  const treeId = req.nextUrl.searchParams.get('tree_id');
  if (!treeId) throw Errors.badRequest('`tree_id` query param is required');

  // Require at least VIEWER role — also validates the tree exists.
  await requireTreeRole(treeId, 'VIEWER');

  const persons = await prisma.person.findMany({
    where: { tree_id: treeId },
    select: PERSON_SELECT,
    orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
  });

  return ok<PersonDto[]>(persons as unknown as PersonDto[]);
});

// ─────────────────────────────────────────────
// POST /api/v1/persons
// ─────────────────────────────────────────────
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: CreatePersonBody = await req.json();

  // Validate required fields.
  if (!body.tree_id?.trim()) throw Errors.badRequest('`tree_id` is required');
  if (!body.first_name?.trim()) throw Errors.badRequest('`first_name` is required');

  // Verify the caller has at least EDITOR rights on this tree.
  await requireTreeRole(body.tree_id, 'EDITOR');

  // Expose strict_lineage status in the response metadata so the
  // client can show an informational banner after creation.
  const strictMode = await isStrictLineageActive(body.tree_id);

  const person = await prisma.person.create({
    data: {
      tree_id:        body.tree_id,
      first_name:     body.first_name.trim(),
      last_name:      body.last_name?.trim()      ?? null,
      maiden_name:    body.maiden_name?.trim()     ?? null,
      gender:         body.gender                  ?? 'UNKNOWN',
      birth_date:     body.birth_date ? new Date(body.birth_date)   : null,
      death_date:     body.death_date ? new Date(body.death_date)   : null,
      birth_place:    body.birth_place?.trim()     ?? null,
      bio:            body.bio?.trim()             ?? null,
      profile_image:  body.profile_image           ?? null,
      first_name_he:  body.first_name_he?.trim()   ?? null,
      last_name_he:   body.last_name_he?.trim()    ?? null,
    },
    select: PERSON_SELECT,
  });

  return ok({ person: person as unknown as PersonDto, strictMode }, 201);
});
