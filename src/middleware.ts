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
//  • GET  /api/v1/trees          → public (is_public trees visible without auth)
//  • POST /api/v1/auth/login     → public
//  • POST /api/v1/auth/signup    → public
//  • ALL  /api/v1/**             → requires auth (write operations, private data)
//  • GET  /[locale]/tree/**      → requires auth
//  • /[locale]/login  /signup   → redirect to home if already authed
// ──────────────────────────────────────────────

// Routes that are always public, even for non-authed users.
const PUBLIC_API_ROUTES: { method: string; pattern: RegExp }[] = [
  { method: 'GET', pattern: /^\/api\/v1\/trees$/ }, // still authenticated in route handler
  { method: 'POST', pattern: /^\/api\/v1\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/signup$/ },
  // Allow logout when session cookie is missing/expired (clear cookies; no 401 loop).
  { method: 'POST', pattern: /^\/api\/v1\/auth\/logout$/ },
  // MVP/TESTING — About page reads/writes are open while requireTreeRole is bypassed.
  // Once auth is re-enabled, drop PATCH from this list so editor checks apply.
  { method: 'GET', pattern: /^\/api\/v1\/trees\/[^/]+\/about$/ },
  { method: 'PATCH', pattern: /^\/api\/v1\/trees\/[^/]+\/about$/ },
  // MVP/TESTING — profile-image uploads are open while there is no login.
  // The route itself enforces that personId belongs to the supplied treeId,
  // and uploads use the service-role key (bypasses Storage RLS / JWT checks).
  // Drop this once auth is re-enabled and the route checks tree role.
  { method: 'POST', pattern: /^\/api\/v1\/uploads\/profile-image$/ },
];

// MVP/TESTING — the UI route guards below are disabled. When restoring auth,
// re-introduce these path lists alongside the matching guards in `middleware()`:
//   const PROTECTED_UI_PATHS = [/^\/[a-z]{2}\/tree/, /^\/[a-z]{2}\/settings/];
//   const AUTH_UI_PATHS      = [/^\/[a-z]{2}\/login/, /^\/[a-z]{2}\/signup/];

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

  // ── Step 3: UI route guards ───────────────
  // MVP/TESTING — both guards commented out so unauthenticated visitors reach
  // all pages directly. To restore auth, uncomment the two blocks below.

  // // Redirect unauthenticated users away from protected pages.
  // const isProtectedUiPath = PROTECTED_UI_PATHS.some((p) => p.test(pathname));
  // if (isProtectedUiPath && !user) {
  //   const locale = pathname.split('/')[1] ?? routing.defaultLocale;
  //   const loginUrl = new URL(`/${locale}/login`, request.url);
  //   loginUrl.searchParams.set('next', pathname); // preserve intended destination
  //   return NextResponse.redirect(loginUrl);
  // }

  // // Redirect already-authenticated users away from login/signup.
  // const isAuthUiPath = AUTH_UI_PATHS.some((p) => p.test(pathname));
  // if (isAuthUiPath && user) {
  //   const locale = pathname.split('/')[1] ?? routing.defaultLocale;
  //   return NextResponse.redirect(new URL(`/${locale}`, request.url));
  // }

  // ── Step 4: i18n locale rewrite ──────────
  // Run the next-intl middleware and merge its response cookies with
  // the Supabase cookies already written onto supabaseResponse.
  const intlResponse = intlMiddleware(request);

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: [
    // All UI routes (excludes _next internals and static files)
    '/((?!_next|_vercel|.*\\..*).*)',
    // All API v1 routes
    '/api/v1/:path*',
  ],
};
