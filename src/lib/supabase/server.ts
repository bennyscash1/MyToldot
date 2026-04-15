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

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
