import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Errors } from './errors';
import type { User } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Server-side Auth Helpers
//
// Use these inside Route Handlers and Server Actions
// to resolve the current user or enforce role checks.
//
// They always call getUser() (not getSession()) to
// validate the JWT against the Supabase Auth server,
// which prevents accepting tampered local cookies.
// ──────────────────────────────────────────────

/**
 * Returns the authenticated Supabase user, or null if not logged in.
 * Use when you want to handle the unauthenticated case yourself.
 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the authenticated user.
 * Throws `Errors.unauthorized()` (→ 401) if there is no session.
 * Use this in any route that requires authentication.
 */
export async function requireAuthUser(): Promise<User> {
  const user = await getAuthUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

/**
 * Checks whether the authenticated user has at least the required role
 * on a specific tree, using our Prisma `TreeMember` table.
 *
 * Throws 401 if not authenticated, 403 if the role is insufficient.
 *
 * Role hierarchy: SUPER_ADMIN > ADMIN > EDITOR > VIEWER
 */
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export async function requireTreeRole(
  treeId: string,
  minimumRole: Role,
): Promise<User> {
  const user = await requireAuthUser();

  const membership = await prisma.treeMember.findUnique({
    where: { tree_id_user_id: { tree_id: treeId, user_id: user.id } },
    select: { role: true },
  });

  if (!membership) throw Errors.forbidden();

  if (ROLE_RANK[membership.role] < ROLE_RANK[minimumRole]) {
    throw Errors.forbidden(
      `This action requires at least the '${minimumRole}' role on this tree.`,
    );
  }

  return user;
}
