import 'server-only';

/** Shared secret for headless /print access (Puppeteer + authenticated preview iframe). */
export function getPdfRenderSecret(): string | null {
  const secret = process.env.PDF_RENDER_SECRET?.trim();
  return secret || null;
}

/** When PDF_RENDER_SECRET is unset, allow /print (local dev). */
export function isValidPdfRenderToken(token: string | null | undefined): boolean {
  const secret = getPdfRenderSecret();
  if (!secret) return true;
  return Boolean(token && token === secret);
}
