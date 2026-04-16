/**
 * POST /api/v1/auth/logout
 *
 * Signs the user out of the current Supabase session.
 * Supabase's server client will clear the session cookies
 * on the response automatically.
 *
 * No body required. Returns 200 on success.
 */

import {
  createSupabaseServerClient,
  isSupabaseServerConfigured,
} from '@/lib/supabase/server';
import { ok, withErrorHandler } from '@/lib/api/response';
import { Errors } from '@/lib/api/errors';

export const POST = withErrorHandler(async () => {
  if (!isSupabaseServerConfigured()) {
    throw Errors.internal('Supabase is not configured on this server');
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw Errors.internal('Failed to sign out');
  }

  return ok({ message: 'Signed out successfully' });
});
