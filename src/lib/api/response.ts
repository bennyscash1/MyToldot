import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from './errors';

// ──────────────────────────────────────────────
// Standard API Response Envelope
//
// Every /api/v1/ route returns ONE of these two
// shapes. The frontend's api.client.ts relies on
// this contract to handle responses uniformly.
//
//  Success: { data: T,    error: null  }
//  Failure: { data: null, error: { code, message } }
//
// This makes client-side exhaustive checking trivial:
//   if (res.error) { showError(res.error.message) }
//   else           { use(res.data) }
// ──────────────────────────────────────────────

export interface ApiSuccessEnvelope<T> {
  data: T;
  error: null;
}

export interface ApiErrorEnvelope {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

// ── Response helpers (used inside route handlers) ──

/** Wrap data in the standard success envelope and return a NextResponse. */
export function ok<T>(data: T, status = 200): NextResponse<ApiSuccessEnvelope<T>> {
  return NextResponse.json({ data, error: null }, { status });
}

/** Wrap an error in the standard error envelope and return a NextResponse. */
export function err(
  error: ApiError | Error | unknown,
  fallbackStatus = 500,
): NextResponse<ApiErrorEnvelope> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { data: null, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  // Unknown error — log it, return a safe generic message.
  console.error('[API] Unhandled error:', error);
  return NextResponse.json(
    {
      data: null,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
    },
    { status: fallbackStatus },
  );
}

/**
 * Wraps a route handler in a try/catch so you never forget error handling.
 *
 * Overloaded to accept both single-argument (no dynamic params) and
 * dual-argument (dynamic route with RouteContext) handler shapes so that
 * Next.js 15's strict route-handler type validator accepts the result.
 *
 * Usage — static route:
 *   export const GET = withErrorHandler(async (req) => { ... });
 *
 * Usage — dynamic route:
 *   export const GET = withErrorHandler(async (req, ctx: RouteContext) => { ... });
 */

// Overload 1: no RouteContext (static routes)
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse>;

// Overload 2: with RouteContext (dynamic routes — [id], etc.)
export function withErrorHandler<TCtx>(
  handler: (req: NextRequest, ctx: TCtx) => Promise<NextResponse>,
): (req: NextRequest, ctx: TCtx) => Promise<NextResponse>;

// Implementation
export function withErrorHandler(
  handler: (req: NextRequest, ctx?: unknown) => Promise<NextResponse>,
): (req: NextRequest, ctx?: unknown) => Promise<NextResponse> {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return err(error);
    }
  };
}
