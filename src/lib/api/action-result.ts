import { ZodError } from 'zod';
import { ApiError } from './errors';

/**
 * Plain-object envelope returned by every Server Action.
 *
 * Server Actions are called directly from client code (not over HTTP), so
 * throwing would surface as a framework-level error and lose the machine-
 * readable code. We mirror the REST envelope shape (`{data, error}`) as a
 * plain object so client hooks can branch uniformly.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fieldErrors?: Record<string, string[]> } };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error: { code, message, fieldErrors } };
}

/**
 * Wraps a server action body so authors can `throw` ApiError / ZodError and
 * get a well-formed envelope back. Uncaught errors are logged and returned as
 * a generic INTERNAL_SERVER_ERROR — never leak raw messages to the client.
 */
export async function withAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return success(await fn());
  } catch (err) {
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of err.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return failure('UNPROCESSABLE_ENTITY', 'Validation failed', fieldErrors);
    }
    if (err instanceof ApiError) {
      return failure(err.code, err.message);
    }
    console.error('[Server Action] Unhandled error:', err);
    return failure('INTERNAL_SERVER_ERROR', 'An unexpected error occurred');
  }
}
