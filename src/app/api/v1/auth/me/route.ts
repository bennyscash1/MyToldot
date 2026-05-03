/**
 * GET /api/v1/auth/me
 *
 * Returns the current authenticated user's basic profile, or
 * `{ user: null }` when no session is present. This endpoint is
 * intentionally public so anonymous visitors can render the
 * read-only UI without seeing a 401 in the console.
 *
 * Editing rights are enforced PER-TREE via TreeMember.role and
 * are NOT exposed here.
 *
 * Self-heal: if a Supabase auth user exists but the public.users
 * mirror row is missing (signup partial-failure, dashboard-created
 * user, etc.), we upsert it so subsequent reads work.
 */

import { getAuthUser } from '@/lib/api/auth';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';

export interface MeProfile {
  id:        string;
  email:     string;
  full_name: string | null;
}

interface MeResponse {
  user: MeProfile | null;
}

const PROFILE_SELECT = {
  id:        true,
  email:     true,
  full_name: true,
} as const;

export const GET = withErrorHandler(async () => {
  const authUser = await getAuthUser();
  if (!authUser) return ok<MeResponse>({ user: null });

  let profile = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: PROFILE_SELECT,
  });

  if (!profile) {
    // Self-heal: create the missing mirror row so per-tree FKs work.
    profile = await prisma.user.upsert({
      where:  { id: authUser.id },
      update: {
        email:     authUser.email ?? '',
        full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      },
      create: {
        id:        authUser.id,
        email:     authUser.email ?? '',
        full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      },
      select: PROFILE_SELECT,
    });
  }

  return ok<MeResponse>({ user: profile });
});
