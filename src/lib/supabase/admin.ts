import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ──────────────────────────────────────────────
// Supabase Admin (Service Role) Client
//
// Use this from server-side code ONLY (Route Handlers,
// Server Actions, background jobs). It is initialized
// with SUPABASE_SERVICE_ROLE_KEY which:
//
//   • bypasses Row-Level Security entirely
//   • never reads cookies, never auto-refreshes a session
//
// That makes it the right tool for storage uploads in our
// anonymous MVP: the regular `@supabase/ssr` clients can
// attach a stale/empty bearer token from the auth cookie
// which Supabase then rejects with "Invalid Compact JWS".
//
// ⚠️  NEVER import this file from a Client Component or
//     anything that ships to the browser. The service role
//     key would leak to the public bundle. The "server-only"
//     marker below makes this a hard build-time error if it
//     is accidentally pulled into client code.
// ──────────────────────────────────────────────

import 'server-only';

let cachedAdmin: SupabaseClient | null = null;

/** True when the env vars required to create the admin client are present. */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Returns a singleton Supabase client authenticated with the service role key.
 * Throws a clear, actionable error if env vars are missing — this surfaces
 * configuration problems instead of producing cryptic 401/403 responses later.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `[supabase-admin] Missing env var(s): ${missing}. ` +
        'Add SUPABASE_SERVICE_ROLE_KEY to your server-side env (Supabase dashboard → Project Settings → API → Service Role) ' +
        'so server-side storage uploads can bypass RLS without a user JWT.',
    );
  }

  cachedAdmin = createClient(url, serviceKey, {
    auth: {
      // Disable everything that would touch a cookie or refresh a session.
      // Service-role calls are stateless — no JWT to refresh, nothing to persist.
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cachedAdmin;
}
