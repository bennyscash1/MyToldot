/**
 * GET /api/v1/auth/me
 *
 * Returns the current authenticated user + their RBAC profile, or
 * `{ user: null }` when no session is present. This endpoint is
 * intentionally public so that anonymous visitors can render the
 * read-only UI without seeing a 401 in the console.
 *
 * Response shape (success, 200):
 *   { user: null }                                    // anonymous
 *   { user: {
 *       id, email, full_name,
 *       is_approved, access_role
 *     } }                                             // authenticated
 *
 * Self-heal: if a Supabase auth user exists but the public.users
 * mirror row is missing (signup partial-failure, dashboard-created
 * user, etc.), we upsert it as a GUEST so subsequent reads work.
 */

import { getAuthUser, getUserProfile, type UserProfile } from '@/lib/api/auth';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';

interface MeResponse {
  user: UserProfile | null;
}

export const GET = withErrorHandler(async () => {
  const authUser = await getAuthUser();
  if (!authUser) return ok<MeResponse>({ user: null });

  let profile = await getUserProfile(authUser.id);

  if (!profile) {
    // Self-heal: create the missing mirror row as an unapproved GUEST.
    profile = await prisma.user.upsert({
      where:  { id: authUser.id },
      update: {
        email:     authUser.email ?? '',
        full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
      },
      create: {
        id:          authUser.id,
        email:       authUser.email ?? '',
        full_name:   (authUser.user_metadata?.full_name as string | undefined) ?? null,
        is_approved: false,
        access_role: 'GUEST',
      },
      select: {
        id:          true,
        email:       true,
        full_name:   true,
        is_approved: true,
        access_role: true,
      },
    });
  }

  return ok<MeResponse>({ user: profile });
});
