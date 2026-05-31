/**
 * Wikimedia / Wikipedia File: pages are HTML — convert to Special:FilePath which
 * redirects to upload.wikimedia.org (works in <img> with referrerPolicy=no-referrer).
 */
export function normalizeExternalImageUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return rawUrl.trim();
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return rawUrl.trim();
  }

  const fileMatch = parsed.pathname.match(/\/wiki\/File:(.+)$/i);
  if (fileMatch && /wikimedia\.org|wikipedia\.org/i.test(parsed.hostname)) {
    const fileName = decodeURIComponent(fileMatch[1]);
    return `${parsed.origin}/wiki/Special:FilePath/${fileName}`;
  }

  return parsed.href;
}

/** Direct Wikimedia CDN URLs (same format that works via paste-URL). */
export function isWikimediaUploadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /(^|\.)upload\.wikimedia\.org$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function isWikimediaFilePathUrl(url: string): boolean {
  return /\/wiki\/Special:FilePath\//i.test(url);
}

/** Props for external images — no crossOrigin (breaks Wikimedia without CORS headers). */
export const EXTERNAL_IMAGE_IMG_PROPS = {
  referrerPolicy: 'no-referrer' as const,
};
