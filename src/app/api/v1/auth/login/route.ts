/**
 * POST /api/v1/auth/login
 *
 * Authenticates a user with email + password via Supabase Auth.
 * On success, Supabase sets HttpOnly session cookies automatically
 * (handled by the @supabase/ssr cookie adapter in server.ts).
 *
 * Body: { email: string, password: string }
 *
 * Returns:
 *  200 { data: { user: UserDto }, error: null }
 *  400 missing fields
 *  401 invalid credentials
 */

import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';

interface LoginBody {
  email: string;
  password: string;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: LoginBody = await req.json();

  if (!body.email?.trim() || !body.password) {
    throw Errors.badRequest('`email` and `password` are required');
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email.trim().toLowerCase(),
    password: body.password,
  });

  if (error || !data.user) {
    // Use a generic message — never confirm whether the email exists.
    throw Errors.unauthorized('Invalid email or password');
  }

  // Return a safe subset of the user — never expose raw Supabase internals.
  return ok({
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name ?? null,
    },
  });
});
