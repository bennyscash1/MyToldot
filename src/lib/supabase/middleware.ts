import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// ──────────────────────────────────────────────
// Supabase Middleware Helper
//
// Called from src/middleware.ts — NOT a standalone
// middleware. It does two things on every request:
//
//  1. Refreshes the Supabase session cookie if it
//     has expired (keeps the user logged in).
//  2. Returns the active session so the caller can
//     make routing decisions (redirect to login, etc.)
//
// We keep this separate from the main middleware so
// it can be unit-tested in isolation and updated
// independently of the next-intl logic.
// ──────────────────────────────────────────────

export async function updateSessionAndGetUser(request: NextRequest) {
  // Start with a plain pass-through response that can be mutated.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto the request first (for downstream handlers)…
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // …then onto the response (so the browser receives them).
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: call getUser() (not getSession()) to validate the JWT
  // against the Supabase server, preventing spoofed session cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
