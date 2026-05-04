import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { updateSessionAndGetUser } from './lib/supabase/middleware';
import {
  PREFERRED_LOCALE_COOKIE,
  parsePreferredLocaleCookie,
  type PreferredLocale,
} from './lib/locale-preference';

// ──────────────────────────────────────────────
// Combined Middleware: Supabase Auth + next-intl
//
// Execution order on every request:
//  1. Supabase — refreshes the session cookie &
//     resolves the active user (or null).
//  2. Route guard — API routes under /api/v1/
//     that require authentication are blocked here.
//  3. Signed-in locale — redirect `/` and `/{locale}/…` to match
//     `User.preferred_language` (cookie mirror + occasional /auth/me fetch).
//  4. next-intl — rewrites the URL to include the
//     correct locale prefix (/he or /en; default /he).
//
// ── Protected route rules ────────────────────
//  • Anonymous visitors can READ the tree (all GET endpoints below).
//  • All POST/PATCH/DELETE endpoints require an authenticated session;
//    the route handler then enforces the per-tree TreeMember.role gate.
//  • Auth endpoints (login/signup/logout/me) are intentionally public.
// ──────────────────────────────────────────────

// Routes that are always public, even for non-authed users.
// All are READ endpoints (or the auth endpoints themselves). Every write
// route is omitted on purpose — the middleware will 401 unauthenticated
// callers, then the handler enforces per-tree role.
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

const intlMiddleware = createIntlMiddleware(routing);

function localeCookieOptions(request: NextRequest) {
  return {
    path:     '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge:   60 * 60 * 24 * 365,
    secure:   request.nextUrl.protocol === 'https:',
  };
}

function mergeSupabaseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((c) => target.cookies.set(c));
}

function maybeSetPreferredLocaleCookie(
  response: NextResponse,
  request: NextRequest,
  shouldSet: boolean,
  locale: PreferredLocale,
) {
  if (shouldSet) {
    response.cookies.set(
      PREFERRED_LOCALE_COOKIE,
      locale,
      localeCookieOptions(request),
    );
  }
}

/**
 * Resolves persisted locale for a signed-in visitor without Prisma (Edge).
 * When the sync cookie is absent, calls GET /api/v1/auth/me with forwarded cookies.
 */
async function resolvePreferredLocaleForSignedInUser(
  request: NextRequest,
): Promise<{ locale: PreferredLocale; setCookie: boolean }> {
  const fromCookie = parsePreferredLocaleCookie(
    request.cookies.get(PREFERRED_LOCALE_COOKIE)?.value,
  );
  if (fromCookie) {
    return { locale: fromCookie, setCookie: false };
  }

  const meUrl = new URL('/api/v1/auth/me', request.nextUrl.origin);
  try {
    const res = await fetch(meUrl.toString(), {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        accept: 'application/json',
      },
      cache: 'no-store',
    });
    const json = (await res.json()) as {
      data?: { user?: { preferred_language?: string } | null } | null;
    };
    const raw = json?.data?.user?.preferred_language;
    const locale: PreferredLocale =
      raw === 'en' || raw === 'he' ? raw : 'he';
    return { locale, setCookie: true };
  } catch {
    return { locale: 'he', setCookie: true };
  }
}

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

  // ── Step 3: Signed-in locale redirect (Edge-safe; no Prisma) ──
  let preferredResolution: {
    locale: PreferredLocale;
    setCookie: boolean;
  } | null = null;

  if (user) {
    preferredResolution = await resolvePreferredLocaleForSignedInUser(request);
    const { locale: preferred, setCookie: needsPrefCookie } = preferredResolution;

    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = `/${preferred}/`;
      const redirectResponse = NextResponse.redirect(url);
      mergeSupabaseCookies(redirectResponse, supabaseResponse);
      maybeSetPreferredLocaleCookie(
        redirectResponse,
        request,
        needsPrefCookie,
        preferred,
      );
      return redirectResponse;
    }

    const localeMatch = pathname.match(/^\/(en|he)(?=\/|$)/);
    if (localeMatch) {
      const urlLocale = localeMatch[1] as PreferredLocale;
      if (urlLocale !== preferred) {
        const newPath =
          pathname.replace(/^\/(en|he)/, `/${preferred}`) || `/${preferred}`;
        const url = request.nextUrl.clone();
        url.pathname = newPath;
        const redirectResponse = NextResponse.redirect(url);
        mergeSupabaseCookies(redirectResponse, supabaseResponse);
        maybeSetPreferredLocaleCookie(
          redirectResponse,
          request,
          needsPrefCookie,
          preferred,
        );
        return redirectResponse;
      }
    }
  }

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

  const needsPrefCookieAfterIntl =
    user && preferredResolution?.setCookie === true;

  // Redirect case — intl is adding a locale prefix.
  if (intlResponse.headers.get('location')) {
    if (needsPrefCookieAfterIntl && preferredResolution) {
      maybeSetPreferredLocaleCookie(
        intlResponse,
        request,
        true,
        preferredResolution.locale,
      );
    }
    return intlResponse;
  }

  // Pass-through case — inject x-pathname so server components can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });

  supabaseResponse.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));
  intlResponse.cookies.getAll().forEach((c) => finalResponse.cookies.set(c));

  if (needsPrefCookieAfterIntl && preferredResolution) {
    maybeSetPreferredLocaleCookie(
      finalResponse,
      request,
      true,
      preferredResolution.locale,
    );
  }

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
