import type { User } from '@supabase/supabase-js';

import { prisma } from '@/lib/prisma';
import { isMissingUserPreferredLanguageColumn } from '@/lib/prisma-user-preferred-language';

/**
 * Ensures the Supabase auth user exists in public.users.
 * Falls back when `preferred_language` hasn't been migrated yet.
 */
export async function ensureMirroredAuthUser(user: User): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
      create: {
        id: user.id,
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        preferred_language: 'he',
      },
    });
  } catch (error) {
    if (!isMissingUserPreferredLanguageColumn(error)) {
      throw error;
    }
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
      create: {
        id: user.id,
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      },
    });
  }
}
