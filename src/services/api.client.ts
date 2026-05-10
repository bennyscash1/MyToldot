import type { ApiEnvelope } from '@/types/api';

// ──────────────────────────────────────────────
// Base API Client
//
// All frontend services call this — never `fetch`
// directly. Benefits:
//  • Single place to inject Auth headers (Phase 3)
//  • Consistent error surface for the entire UI
//  • Typed responses via the ApiEnvelope contract
//
// ⚠️  This file must NEVER import from lib/prisma.ts.
//    It is purely a fetch wrapper.
// ──────────────────────────────────────────────

/** The shape thrown when the API returns an error envelope. */
export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
}

/**
 * Core fetch function.
 * Unwraps the ApiEnvelope — returns `data` on success,
 * throws `ServiceError` on failure.
 */
async function request<T>(
  path: string,
  { method = 'GET', body, headers = {} }: RequestOptions = {},
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Phase 3: inject `Authorization: Bearer <token>` here
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Disable Next.js static caching for API calls by default.
    // Individual services can override this per-call.
    cache: 'no-store',
  });

  const envelope: ApiEnvelope<T> = await res.json();

  if (envelope.error !== null) {
    const err = envelope.error as {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    throw new ServiceError(err.code, err.message, res.status, err.details);
  }

  return envelope.data;
}

// ── Public API ──

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    request<T>(path, { method: 'GET', headers }),

  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'POST', body, headers }),

  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'PATCH', body, headers }),

  delete: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: 'DELETE', body, headers }),
};
