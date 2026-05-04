import { Prisma } from '@prisma/client';

/**
 * True when Postgres (or Prisma schema) does not yet have `users.preferred_language`
 * — e.g. migration not applied. Lets the app fall back to defaults + cookie-only UX.
 */
export function isMissingUserPreferredLanguageColumn(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  const msg = error.message;
  return (
    (error.code === 'P2022' && msg.includes('preferred_language')) ||
    (msg.includes('preferred_language') && msg.includes('does not exist'))
  );
}
