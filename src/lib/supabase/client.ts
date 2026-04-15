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

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
