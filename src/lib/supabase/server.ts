import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// ──────────────────────────────────────────────
// Supabase Server Client
//
// Use this in:
//  • Server Components
//  • Route Handlers  (src/app/api/v1/**)
//  • Server Actions
//
// It reads/writes the session cookie via Next.js
// `cookies()`, which requires a request context.
// Never use this in Client Components — use
// src/lib/supabase/client.ts instead.
// ──────────────────────────────────────────────

function warnMissingSupabaseServerEnvOnce() {
  if (process.env.NODE_ENV === 'production') return;

  const warningKey = '__supabaseServerEnvWarningShown';
  if ((globalThis as Record<string, unknown>)[warningKey]) return;

  (globalThis as Record<string, unknown>)[warningKey] = true;
  console.warn(
    '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth API routes will fail until .env.local is configured.',
  );
}

export function isSupabaseServerConfigured() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!configured) {
    warnMissingSupabaseServerEnvOnce();
  }

  return configured;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Local/dev fallback: if Supabase env vars are not configured yet,
  // return a no-op client that always reports `user: null`.
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      auth: {
        async getUser() {
          return { data: { user: null }, error: null };
        },
      },
    } as unknown as ReturnType<typeof createServerClient>;
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // `setAll` is called from a Server Component where cookies
            // cannot be mutated. The middleware will handle refresh.
          }
        },
      },
    },
  );
}
