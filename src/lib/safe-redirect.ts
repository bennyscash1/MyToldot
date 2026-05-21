/**
 * Validates a post-auth redirect target from query params (login/signup/OAuth).
 * Only same-origin relative paths are allowed.
 */
export function resolveSafeNextPath(rawNext: string | null | undefined): string | null {
  if (!rawNext) return null;
  const trimmed = rawNext.trim();
  if (!trimmed.startsWith('/')) return null;
  // Reject protocol-relative or absolute URLs.
  if (trimmed.startsWith('//')) return null;
  if (trimmed.includes('://')) return null;
  // Block callback loops and API jumps.
  if (trimmed.startsWith('/api/')) return null;
  return trimmed;
}

/** Builds `?redirect=...` for auth links when a safe path is present. */
export function buildRedirectQuery(safePath: string | null): string {
  if (!safePath) return '';
  return `?redirect=${encodeURIComponent(safePath)}`;
}
