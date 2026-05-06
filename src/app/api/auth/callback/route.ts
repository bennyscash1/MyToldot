import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import {
  PREFERRED_LOCALE_COOKIE,
  PREFERRED_LOCALE_MAX_AGE_SECONDS,
  parsePreferredLocale,
  parsePreferredLocaleCookie,
} from '@/lib/locale-preference';

type AuthProvider = 'manual' | 'google' | 'both';

function resolveNextAuthProvider(current: string): AuthProvider {
  // GOOGLE AUTH ADDED: preserve manual-only users, upgrade to both when Google is linked.
  if (current === 'manual') return 'both';
  if (current === 'google') return 'google';
  return 'both';
}

function buildLoginErrorRedirect(request: NextRequest) {
  const url = new URL('/login', request.nextUrl.origin);
  url.searchParams.set('error', 'oauth_failed');
  return NextResponse.redirect(url);
}

function resolveSafeNextPath(rawNext: string | null): string | null {
  if (!rawNext) return null;
  if (!rawNext.startsWith('/')) return null;
  // Block callback loops and API jumps.
  if (rawNext.startsWith('/api/')) return null;
  return rawNext;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const safeNextPath = resolveSafeNextPath(
    request.nextUrl.searchParams.get('next'),
  );

  try {
    const code = request.nextUrl.searchParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return buildLoginErrorRedirect(request);
    }

    const {
      data: { user: supabaseUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !supabaseUser?.id || !supabaseUser.email) {
      return buildLoginErrorRedirect(request);
    }

    const normalizedEmail = supabaseUser.email.trim().toLowerCase();
    const preferredFromCookie = parsePreferredLocaleCookie(
      request.cookies.get(PREFERRED_LOCALE_COOKIE)?.value,
    );

    const existingRows = await prisma.$queryRaw<
      Array<{
        id: string;
        preferred_language: string | null;
        authProvider: string | null;
      }>
    >`SELECT "id", "preferred_language", "authProvider" FROM "users" WHERE "email" = ${normalizedEmail} LIMIT 1`;
    const existing = existingRows[0] ?? null;

    let redirectLocale = preferredFromCookie ?? 'he';

    if (existing) {
      // GOOGLE AUTH ADDED: save Google identity for the existing email owner.
      await prisma.$executeRaw`
        UPDATE "users"
        SET "googleId" = ${supabaseUser.id},
            "authProvider" = ${resolveNextAuthProvider(existing.authProvider ?? 'manual')},
            "email" = ${normalizedEmail}
        WHERE "id" = ${existing.id}
      `;
      redirectLocale =
        parsePreferredLocale(existing.preferred_language) ?? redirectLocale;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "users" ("id", "email", "full_name", "googleId", "authProvider")
        VALUES (
          ${supabaseUser.id},
          ${normalizedEmail},
          ${(supabaseUser.user_metadata?.full_name as string | undefined) ?? null},
          ${supabaseUser.id},
          'google'
        )
      `;
    }

    if (safeNextPath) {
      const response = NextResponse.redirect(new URL(safeNextPath, request.nextUrl.origin));
      response.cookies.set(PREFERRED_LOCALE_COOKIE, redirectLocale, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: PREFERRED_LOCALE_MAX_AGE_SECONDS,
        secure: request.nextUrl.protocol === 'https:',
      });
      return response;
    }

    const response = NextResponse.redirect(
      new URL(`/${redirectLocale}`, request.nextUrl.origin),
    );
    response.cookies.set(PREFERRED_LOCALE_COOKIE, redirectLocale, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: PREFERRED_LOCALE_MAX_AGE_SECONDS,
      secure: request.nextUrl.protocol === 'https:',
    });
    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Duplicate safety guard (email/googleId unique constraints).
      return buildLoginErrorRedirect(request);
    }
    return buildLoginErrorRedirect(request);
  }
}
