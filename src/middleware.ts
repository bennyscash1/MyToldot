import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSessionAndGetUser } from './lib/supabase/middleware';

// ──────────────────────────────────────────────
// Combined Middleware: Supabase Auth + next-intl
//
// Execution order on every request:
//  1. Supabase — refreshes the session cookie &
//     resolves the active user (or null).
//  2. Route guard — API routes under /api/v1/
//     that require authentication are blocked here.
//  3. next-intl — rewrites the URL to include the
//     correct locale prefix (/en or /he).
//
// ── Protected route rules ────────────────────
//  • Anonymous visitors can READ the tree (all GET endpoints below).
//  • All POST/PATCH/DELETE endpoints require an authenticated session;
//    the route handler then checks `is_approved` + `access_role` for
//    editor/admin gating.
//  • Auth endpoints (login/signup/logout/me) are intentionally public.
// ──────────────────────────────────────────────

// Routes that are always public, even for non-authed users.
// All are READ endpoints (or the auth endpoints themselves). Every write
// route is omitted on purpose — the middleware will 401 unauthenticated
// callers, then the handler enforces approval/role.
const PUBLIC_API_ROUTES: { method: string; pattern: RegExp }[] = [
  // Auth endpoints
  { method: 'POST', pattern: /^\/api\/v1\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/signup$/ },
  // Allow logout when session cookie is missing/expired (clear cookies; no 401 loop).
  { method: 'POST', pattern: /^\/api\/v1\/auth\/logout$/ },
  // Public profile lookup — returns `{ user: null }` for anonymous visitors.
  { method: 'GET', pattern: /^\/api\/v1\/auth\/me$/ },

  // Tree reads (anonymous browsing of the family tree).
  { method: 'GET', pattern: /^\/api\/v1\/trees$/ },
  { method: 'GET', pattern: /^\/api\/v1\/trees\/[^/]+\/about$/ },

  // Person reads.
  { method: 'GET', pattern: /^\/api\/v1\/persons$/ },
  { method: 'GET', pattern: /^\/api\/v1\/persons\/[^/]+$/ },
];

// All UI routes (including /tree) are publicly accessible so anonymous
// visitors can browse the family tree in read-only mode. Per-page server
// components (e.g. /[locale]/login) handle their own redirect logic when
// an authenticated visitor lands there.

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Step 1: Refresh Supabase session ──
  const { response: supabaseResponse, user } =
    await updateSessionAndGetUser(request);

  // ── Step 2: API route guards ──────────────
  if (pathname.startsWith('/api/v1/')) {
    const isPublicApiRoute = PUBLIC_API_ROUTES.some(
      (r) => r.method === request.method && r.pattern.test(pathname),
    );

    if (!isPublicApiRoute && !user) {
      return NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    // Pass through — session cookies already set on supabaseResponse.
    return supabaseResponse;
  }

  // ── Step 3: UI routes are public ──────────
  // Anonymous visitors can browse every page (read-only). Login/signup pages
  // and other protected screens enforce their own server-side redirects.
  void user; // hint to the linter that the resolved user is intentionally unused here

  // ── Step 4: i18n locale rewrite ──────────
  // Run the next-intl middleware, then decide how to respond:
  //
  //  a) If intl issued a redirect (locale prefix missing), forward it as-is
  //     with Supabase cookies merged.
  //  b) Otherwise, rebuild as NextResponse.next() with the current pathname
  //     injected into the forwarded request headers. This makes the path
  //     available in server components (e.g. Navbar) via
  //     `(await headers()).get('x-pathname')` without any client-side JS.
  const intlResponse = intlMiddleware(request);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  // Redirect case — intl is adding a locale prefix.
  if (intlResponse.headers.get('location')) {
    return intlResponse;
  }

  // Pass-through case — inject x-pathname so server components can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });

  supabaseResponse.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
  intlResponse.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));

  return finalResponse;
}

export const config = {
  matcher: [
    // All UI routes (excludes _next internals and static files)
    '/((?!_next|_vercel|.*\\..*).*)',
    // All API v1 routes
    '/api/v1/:path*',
  ],
};
