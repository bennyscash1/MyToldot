'use client';

import { createBrowserClient } from '@supabase/ssr';

// ──────────────────────────────────────────────
// Supabase Browser Client
//
// Use this ONLY in Client Components ('use client').
// It stores the session in a cookie so the server
// client can read it on subsequent requests.
//
// Dev fallback: if the env vars are not set yet
// (local dev before .env.local is filled in),
// createSupabaseBrowserClient() returns null and
// callers guard against it — no hard runtime crash.
// ──────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both required Supabase env vars are present. */
export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(url && key);
}

/**
 * Returns a Supabase browser client, or null when env vars are missing.
 * Always call isSupabaseBrowserConfigured() first, or null-check the result.
 */
export function createSupabaseBrowserClient() {
  if (!url || !key) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
          'is not set. Auth features are disabled until you add these to .env.local.',
      );
    }
    return null;
  }
  return createBrowserClient(url, key);
}
