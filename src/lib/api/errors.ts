// ──────────────────────────────────────────────
// API Error Types
//
// Typed error classes used inside /api/v1/ routes.
// Throwing one of these lets the response helper
// serialize it consistently.
// ──────────────────────────────────────────────

/** Machine-readable error codes sent in every error response. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'INTERNAL_SERVER_ERROR';

/** Structured error thrown inside API route handlers. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Convenience constructors ──

export const Errors = {
  badRequest: (msg = 'Bad request') =>
    new ApiError('BAD_REQUEST', msg, 400),

  unauthorized: (msg = 'Authentication required') =>
    new ApiError('UNAUTHORIZED', msg, 401),

  forbidden: (msg = 'You do not have permission to perform this action') =>
    new ApiError('FORBIDDEN', msg, 403),

  notFound: (resource = 'Resource') =>
    new ApiError('NOT_FOUND', `${resource} not found`, 404),

  conflict: (msg = 'Resource already exists') =>
    new ApiError('CONFLICT', msg, 409),

  unprocessable: (msg = 'Validation failed') =>
    new ApiError('UNPROCESSABLE_ENTITY', msg, 422),

  internal: (msg = 'An unexpected error occurred') =>
    new ApiError('INTERNAL_SERVER_ERROR', msg, 500),
} as const;
