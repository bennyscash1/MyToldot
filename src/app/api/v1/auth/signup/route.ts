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
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';

interface SignupBody {
  email: string;
  password: string;
  full_name: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: SignupBody = await req.json();

  if (!body.email?.trim() || !body.password || !body.full_name?.trim()) {
    throw Errors.badRequest('`email`, `password`, and `full_name` are required');
  }

  if (body.password.length < 8) {
    throw Errors.unprocessable('Password must be at least 8 characters');
  }

  const supabase = await createSupabaseServerClient();

  // 1. Create the Supabase Auth user.
  const { data, error } = await supabase.auth.signUp({
    email: body.email.trim().toLowerCase(),
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
  const user = await prisma.user.upsert({
    where: { id: data.user.id },
    update: { email: data.user.email!, full_name: body.full_name.trim() },
    create: {
      id: data.user.id,
      email: data.user.email!,
      full_name: body.full_name.trim(),
    },
    select: { id: true, email: true, full_name: true },
  });

  return ok({ user }, 201);
});
