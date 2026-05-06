/**
 * POST /api/v1/auth/signup
 *
 * Creates a new Supabase Auth user and an associated record in our
 * public `users` table (via Prisma) in a single operation.
 *
 * Body: { email: string, password: string, full_name: string }
 *
 * Returns:
 *  201 { data: { user: UserDto }, error: null }
 *  400 missing/invalid fields
 *  409 email already registered
 */

import { NextRequest } from 'next/server';
import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { isMissingUserPreferredLanguageColumn } from '@/lib/prisma-user-preferred-language';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';
import {
  PREFERRED_LOCALE_COOKIE,
  PREFERRED_LOCALE_MAX_AGE_SECONDS,
} from '@/lib/locale-preference';

interface SignupBody {
  email: string;
  password: string;
  full_name: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: SignupBody = await req.json();
  const normalizedEmail = body.email?.trim().toLowerCase() ?? '';

  if (!normalizedEmail || !body.password || !body.full_name?.trim()) {
    throw Errors.badRequest('`email`, `password`, and `full_name` are required');
  }

  if (body.password.length < 8) {
    throw Errors.unprocessable('Password must be at least 8 characters');
  }

  if (!isSupabaseServerConfigured()) {
    throw Errors.internal('Supabase is not configured on this server');
  }

  // GOOGLE AUTH ADDED: enforce email-first uniqueness before creating auth users.
  const existingByEmail = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existingByEmail) {
    throw Errors.conflict('An account with this email already exists. Please log in.');
  }

  const supabase = await createSupabaseServerClient();

  // 1. Create the Supabase Auth user.
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: body.password,
    options: {
      data: { full_name: body.full_name.trim() },
    },
  });

  if (error) {
    // Supabase returns "User already registered" for duplicate emails.
    if (error.message.toLowerCase().includes('already registered')) {
      throw Errors.conflict('An account with this email already exists');
    }
    throw Errors.internal(error.message);
  }

  if (!data.user) {
    throw Errors.internal('User creation returned no user object');
  }

  // 2. Mirror the user into our public `users` table so Prisma relations work.
  //    upsert in case Supabase triggers or a previous partial signup left a row.
  let user: { id: string; email: string | undefined; full_name: string | null } = {
    id: data.user.id,
    email: data.user.email,
    full_name: body.full_name.trim(),
  };

  try {
    user = await prisma.user.upsert({
      where: { id: data.user.id },
      update: { email: data.user.email!, full_name: body.full_name.trim() },
      create: {
        id:                 data.user.id,
        email:              data.user.email!,
        full_name:          body.full_name.trim(),
        // GOOGLE AUTH ADDED: explicit provider marker for manual registrations.
        authProvider:       'manual',
        preferred_language: 'he',
      },
      select: { id: true, email: true, full_name: true },
    });
  } catch (dbError) {
    if (isMissingUserPreferredLanguageColumn(dbError)) {
      user = await prisma.user.upsert({
        where: { id: data.user.id },
        update: { email: data.user.email!, full_name: body.full_name.trim() },
        create: {
          id:        data.user.id,
          email:     data.user.email!,
          full_name: body.full_name.trim(),
          // GOOGLE AUTH ADDED: explicit provider marker for manual registrations.
          authProvider: 'manual',
        },
        select: { id: true, email: true, full_name: true },
      });
    } else {
      // Local-only fallback: allow signup to succeed when Prisma cannot
      // reach Postgres (common on IPv6-restricted networks).
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Auth] Signup mirrored user skipped (DB unavailable):', dbError);
      } else {
        throw dbError;
      }
    }
  }

  const response = ok({ user }, 201);
  response.cookies.set(PREFERRED_LOCALE_COOKIE, 'he', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: PREFERRED_LOCALE_MAX_AGE_SECONDS,
    secure: req.nextUrl.protocol === 'https:',
  });
  return response;
});
