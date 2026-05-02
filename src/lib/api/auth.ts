import type { User } from '@supabase/supabase-js';
import type { AccessRole, TreeMemberRole } from '@prisma/client';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/library';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Errors } from './errors';

function isDbConnectivityError(error: unknown): boolean {
  if (error instanceof PrismaClientInitializationError) return true;
  if (error instanceof PrismaClientKnownRequestError) {
    return ['P1000', 'P1001', 'P1017'].includes(error.code);
  }
  // Turbopack / bundling can duplicate Prisma's error classes, breaking `instanceof`.
  if (error && typeof error === 'object') {
    const e = error as {
      name?: string;
      code?: string;
      errorCode?: string;
      message?: string;
    };
    if (e.name === 'PrismaClientInitializationError') return true;
    if (['P1000', 'P1001', 'P1017'].includes(String(e.code ?? ''))) return true;
    const msg = typeof e.message === 'string' ? e.message : '';
    if (
      msg.includes("Can't reach database server") ||
      msg.includes("Can't reach database") ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('Connection terminated') ||
      msg.includes('Server has closed the connection')
    ) {
      return true;
    }
  }
  return false;
}

// ──────────────────────────────────────────────
// Server-side Auth Helpers
//
// Used inside Route Handlers, Server Components,
// and Server Actions to resolve the current user
// and enforce permission checks.
//
// We always call getUser() (not getSession()) so
// the JWT is validated against Supabase Auth, which
// blocks tampered local cookies.
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
// App-wide RBAC (admin-approval gate)
// ─────────────────────────────────────────────

export interface UserProfile {
  id:           string;
  email:        string;
  full_name:    string | null;
  is_approved:  boolean;
  access_role:  AccessRole;
}

/**
 * Loads the public.users mirror row for a given Supabase auth user.
 * Returns null if the row hasn't been created yet (caller decides what to do).
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:          true,
        email:       true,
        full_name:   true,
        is_approved: true,
        access_role: true,
      },
    });
    return profile;
  } catch (error) {
    // Pooler / network / paused project — avoid crashing public RSC routes.
    if (isDbConnectivityError(error)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[getUserProfile] Database unreachable; returning null profile.',
          error instanceof Error ? error.message : error,
        );
      }
      return null;
    }
    throw error;
  }
}

/**
 * Convenience wrapper: resolves auth user + their profile in one call.
 * Returns null when there is no session (public reads pass through).
 */
export async function getCurrentUserWithProfile(): Promise<
  { user: User; profile: UserProfile | null } | null
> {
  const user = await getAuthUser();
  if (!user) return null;
  const profile = await getUserProfile(user.id);
  return { user, profile };
}

/**
 * Gate for any "write" action on the app.
 * Requires:
 *  • a valid session (else 401),
 *  • a mirrored profile flagged `is_approved = true`,
 *  • `access_role` of EDITOR or ADMIN.
 *
 * Throws 403 with a precise message otherwise.
 */
export async function requireApprovedEditor(): Promise<{ user: User; profile: UserProfile }> {
  const user = await requireAuthUser();
  const profile = await getUserProfile(user.id);

  if (!profile) {
    // Auth user exists but the public.users mirror is missing — treat as
    // unapproved so the route fails closed. The /api/v1/auth/me endpoint
    // self-heals this on the next read.
    throw Errors.forbidden('Account awaiting admin approval');
  }
  if (!profile.is_approved) {
    throw Errors.forbidden('Account awaiting admin approval');
  }
  if (profile.access_role === 'GUEST') {
    throw Errors.forbidden('Edit permission required — please contact an administrator');
  }

  return { user, profile };
}

/**
 * Gate for destructive / admin-only actions (deletes, settings).
 * Layers on top of `requireApprovedEditor` and additionally requires
 * `access_role = ADMIN`.
 */
export async function requireApprovedAdmin(): Promise<{ user: User; profile: UserProfile }> {
  const result = await requireApprovedEditor();
  if (result.profile.access_role !== 'ADMIN') {
    throw Errors.forbidden('Admin permission required');
  }
  return result;
}

// ─────────────────────────────────────────────
// Per-tree role check (kept for future multi-tenant flows)
// ─────────────────────────────────────────────

const TREE_ROLE_RANK: Record<TreeMemberRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  OWNER:  2,
};

/**
 * Checks whether the authenticated user has at least the required role
 * on a specific tree, using the `TreeMember` table.
 *
 * Throws 401 if not authenticated, 403 if the role is insufficient.
 *
 * Currently unused by the global RBAC flow, but available if/when the
 * app moves to per-tree memberships.
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
