import type { User } from '@supabase/supabase-js';
import type { TreeMemberRole } from '@prisma/client';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Errors } from './errors';

// ──────────────────────────────────────────────
// Server-side Auth Helpers
//
// All editing rights are enforced PER-TREE via TreeMember.role.
// There is no global "is_approved" gate anymore — anyone with a
// session can browse, and writes are gated by `requireTreeRole`.
//
// We always call getUser() (not getSession()) so the JWT is
// validated against Supabase Auth, which blocks tampered local
// cookies.
// ──────────────────────────────────────────────

// ─────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────

/**
 * Returns the authenticated Supabase user, or null when not logged in.
 * Use when you want to handle the unauthenticated case yourself
 * (e.g. a public page that conditionally renders editor UI).
 */
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Returns the authenticated user.
 * Throws `Errors.unauthorized()` (→ 401) if there is no session.
 */
export async function requireAuthUser(): Promise<User> {
  const user = await getAuthUser();
  if (!user) throw Errors.unauthorized();
  return user;
}

// ─────────────────────────────────────────────
// Per-tree role check (the only RBAC layer)
// ─────────────────────────────────────────────

// EDITOR_PENDING is intentionally ranked the same as VIEWER:
// the request was made but hasn't been approved, so the user
// must not be allowed to edit yet.
const TREE_ROLE_RANK: Record<TreeMemberRole, number> = {
  VIEWER:         0,
  EDITOR_PENDING: 0,
  EDITOR:         1,
  OWNER:          2,
};

/**
 * Checks whether the authenticated user has at least the required role
 * on a specific tree, using the `TreeMember` table.
 *
 * Throws 401 if not authenticated, 403 if the role is insufficient.
 */
export async function requireTreeRole(
  treeId: string,
  minimumRole: TreeMemberRole,
): Promise<User> {
  const user = await requireAuthUser();

  const membership = await prisma.treeMember.findUnique({
    where: { tree_id_user_id: { tree_id: treeId, user_id: user.id } },
    select: { role: true },
  });

  if (!membership) {
    throw Errors.forbidden('You are not a member of this tree');
  }

  if (TREE_ROLE_RANK[membership.role] < TREE_ROLE_RANK[minimumRole]) {
    throw Errors.forbidden(
      `This action requires at least the '${minimumRole}' role on this tree.`,
    );
  }

  return user;
}

/**
 * Resolves the current authenticated user's role on a tree, or null when
 * not a member / not authenticated. Use this in server components to
 * decide what UI affordances to render.
 */
export async function getCurrentUserTreeRole(
  treeId: string,
): Promise<TreeMemberRole | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const membership = await prisma.treeMember.findUnique({
    where: { tree_id_user_id: { tree_id: treeId, user_id: user.id } },
    select: { role: true },
  });
  return membership?.role ?? null;
}
