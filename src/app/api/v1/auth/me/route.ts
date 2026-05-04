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
import {
  parsePreferredLocale,
  type PreferredLocale,
} from '@/lib/locale-preference';
import { isMissingUserPreferredLanguageColumn } from '@/lib/prisma-user-preferred-language';

export interface MeProfile {
  id:                  string;
  email:               string;
  full_name:           string | null;
  preferred_language:  PreferredLocale;
}

interface MeResponse {
  user: MeProfile | null;
}

const PROFILE_SELECT = {
  id:                  true,
  email:               true,
  full_name:           true,
  preferred_language:  true,
} as const;

const PROFILE_SELECT_FALLBACK = {
  id:        true,
  email:     true,
  full_name: true,
} as const;

export const GET = withErrorHandler(async () => {
  const authUser = await getAuthUser();
  if (!authUser) return ok<MeResponse>({ user: null });

  try {
    let profile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: PROFILE_SELECT,
    });

    if (!profile) {
      profile = await prisma.user.upsert({
        where:  { id: authUser.id },
        update: {
          email:     authUser.email ?? '',
          full_name: (authUser.user_metadata?.full_name as string | undefined) ?? null,
        },
        create: {
          id:                 authUser.id,
          email:              authUser.email ?? '',
          full_name:          (authUser.user_metadata?.full_name as string | undefined) ?? null,
          preferred_language: 'he',
        },
        select: PROFILE_SELECT,
      });
    }

    const preferred_language: PreferredLocale =
      parsePreferredLocale(profile.preferred_language) ?? 'he';

    return ok<MeResponse>({
      user: { ...profile, preferred_language },
    });
  } catch (e) {
    if (!isMissingUserPreferredLanguageColumn(e)) throw e;

    let profile = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: PROFILE_SELECT_FALLBACK,
    });

    if (!profile) {
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
        select: PROFILE_SELECT_FALLBACK,
      });
    }

    const preferred_language: PreferredLocale = 'he';

    return ok<MeResponse>({
      user: { ...profile, preferred_language },
    });
  }
});
