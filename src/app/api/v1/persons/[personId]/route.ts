/**
 * /api/v1/persons/[personId]
 *
 * GET    → fetch a single person  (requires VIEWER+)
 * PATCH  → update person fields   (requires EDITOR+)
 * DELETE → remove person          (requires ADMIN+)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import { requireTreeRole } from '@/lib/api/auth';
import { deleteProfileImage } from '@/lib/supabase/storage';
import type { UpdatePersonBody, PersonDto } from '@/types/api';

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

type RouteContext = { params: Promise<{ personId: string }> };

// ── Shared helper: resolve person or 404 ──
async function findPersonOrThrow(personId: string) {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: { ...PERSON_SELECT },
  });
  if (!person) throw Errors.notFound('Person');
  return person;
}

// ─────────────────────────────────────────────
// GET /api/v1/persons/:id
// ─────────────────────────────────────────────
export const GET = withErrorHandler(async (_req: NextRequest, ctx: RouteContext) => {
  const { personId } = await ctx.params;
  const person = await findPersonOrThrow(personId);
  await requireTreeRole(person.tree_id, 'VIEWER');
  return ok<PersonDto>(person as unknown as PersonDto);
});

// ─────────────────────────────────────────────
// PATCH /api/v1/persons/:id
// ─────────────────────────────────────────────
export const PATCH = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { personId } = await ctx.params;
  const person = await findPersonOrThrow(personId);
  await requireTreeRole(person.tree_id, 'EDITOR');

  const body: UpdatePersonBody = await req.json();

  const updated = await prisma.person.update({
    where: { id: personId },
    data: {
      ...(body.first_name    !== undefined && { first_name:    body.first_name.trim()    }),
      ...(body.last_name     !== undefined && { last_name:     body.last_name?.trim()    ?? null }),
      ...(body.maiden_name   !== undefined && { maiden_name:   body.maiden_name?.trim()  ?? null }),
      ...(body.gender        !== undefined && { gender:        body.gender               }),
      ...(body.birth_date    !== undefined && { birth_date:    body.birth_date ? new Date(body.birth_date)   : null }),
      ...(body.death_date    !== undefined && { death_date:    body.death_date ? new Date(body.death_date)   : null }),
      ...(body.birth_place   !== undefined && { birth_place:   body.birth_place?.trim()  ?? null }),
      ...(body.bio           !== undefined && { bio:           body.bio?.trim()          ?? null }),
      ...(body.profile_image !== undefined && { profile_image: body.profile_image        ?? null }),
      ...(body.first_name_he !== undefined && { first_name_he: body.first_name_he?.trim() ?? null }),
      ...(body.last_name_he  !== undefined && { last_name_he:  body.last_name_he?.trim()  ?? null }),
    },
    select: PERSON_SELECT,
  });

  return ok<PersonDto>(updated as unknown as PersonDto);
});

// ─────────────────────────────────────────────
// DELETE /api/v1/persons/:id
// ─────────────────────────────────────────────
export const DELETE = withErrorHandler(async (_req: NextRequest, ctx: RouteContext) => {
  const { personId } = await ctx.params;
  const person = await findPersonOrThrow(personId);
  await requireTreeRole(person.tree_id, 'ADMIN');

  // Clean up storage before deleting the DB record.
  if (person.profile_image) {
    await deleteProfileImage(person.profile_image);
  }

  await prisma.person.delete({ where: { id: personId } });

  return ok({ deleted: true });
});
