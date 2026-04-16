'use client';

import { createBrowserClient } from '@supabase/ssr';

// ──────────────────────────────────────────────
// Supabase Browser Client
//
// Use this ONLY in Client Components ('use client').
// It stores the session in a cookie so the server
// client can read it on subsequent requests.
//
// The client is intentionally not a singleton here
// because createBrowserClient() is already internally
// optimised (it reuses the same underlying instance
// per env/key pair across a browser session).
// ──────────────────────────────────────────────

function warnMissingSupabaseBrowserEnvOnce() {
  if (process.env.NODE_ENV === 'production') return;

  const warningKey = '__supabaseBrowserEnvWarningShown';
  if ((globalThis as Record<string, unknown>)[warningKey]) return;

  (globalThis as Record<string, unknown>)[warningKey] = true;
  console.warn(
    '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Browser auth is disabled until .env.local is configured.',
  );
}

export function isSupabaseBrowserConfigured() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!configured) {
    warnMissingSupabaseBrowserEnvOnce();
  }

  return configured;
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
