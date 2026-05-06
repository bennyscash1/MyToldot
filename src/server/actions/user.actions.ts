'use server';

import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/api/auth';
import { withAction, type ActionResult } from '@/lib/api/action-result';
import { isMissingUserPreferredLanguageColumn } from '@/lib/prisma-user-preferred-language';
import {
  PREFERRED_LOCALE_COOKIE,
  PREFERRED_LOCALE_MAX_AGE_SECONDS,
  PreferredLocaleSchema,
  type PreferredLocale,
} from '@/lib/locale-preference';

// ──────────────────────────────────────────────
// User preferences — Server Actions
// ──────────────────────────────────────────────

function preferredLocaleCookieOptions() {
  return {
    path:     '/' as const,
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge:   PREFERRED_LOCALE_MAX_AGE_SECONDS,
    secure:   process.env.NODE_ENV === 'production',
  };
}

/**
 * Persists UI language for the signed-in user (Postgres mirror + httpOnly cookie
 * so Edge middleware can apply redirects without Prisma).
 */
export async function updateUserLanguage(
  lang: string,
): Promise<ActionResult<{ preferred_language: PreferredLocale }>> {
  return withAction(async () => {
    const preferred_language = PreferredLocaleSchema.parse(lang);
    const user = await requireAuthUser();

    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: { preferred_language },
        create: {
          id:                 user.id,
          email:              user.email ?? '',
          full_name:          (user.user_metadata?.full_name as string | undefined) ?? null,
          preferred_language,
        },
      });
    } catch (e) {
      if (!isMissingUserPreferredLanguageColumn(e)) throw e;
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          email:     user.email ?? '',
          full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        },
        create: {
          id:        user.id,
          email:     user.email ?? '',
          full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        },
      });
    }

    const cookieStore = await cookies();
    cookieStore.set(
      PREFERRED_LOCALE_COOKIE,
      preferred_language,
      preferredLocaleCookieOptions(),
    );

    return { preferred_language };
  });
}
