import {
  isWikimediaFilePathUrl,
  isWikimediaUploadUrl,
  normalizeExternalImageUrl,
} from '@/lib/images/normalize-external-image-url';

const BLOCKED_DOMAINS = [
  'shutterstock.com',
  'gettyimages.com',
  'istockphoto.com',
  'alamy.com',
  'depositphotos.com',
  '123rf.com',
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'dreamstime.com',
  'freepik.com',
];

const FETCH_TIMEOUT_MS = 5000;

export type ResolveExternalImageUrlResult =
  | { ok: true; url: string; contentType: string }
  | { ok: false; reason: string };

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isBlockedDomain(hostname: string): boolean {
  return BLOCKED_DOMAINS.some(
    (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
  );
}

async function probeImageUrl(url: string): Promise<ResolveExternalImageUrlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'Toldotay/1.0 (image-url-validator)',
      },
    });

    if (response.status === 405) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'image/*,*/*;q=0.8',
          Range: 'bytes=0-512',
          'User-Agent': 'Toldotay/1.0 (image-url-validator)',
        },
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.startsWith('image/')) {
      return { ok: true, url: response.url, contentType };
    }

    return { ok: false, reason: 'URL does not serve an image' };
  } catch {
    return { ok: false, reason: 'Could not verify image URL' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes wiki page URLs, verifies the target serves image/* when possible,
 * and returns a URL suitable for use in <img src> (with referrerPolicy=no-referrer).
 */
export async function resolveExternalImageUrl(
  rawUrl: string,
): Promise<ResolveExternalImageUrlResult> {
  const normalized = normalizeExternalImageUrl(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'URL must use HTTPS' };
  }

  const hostname = hostnameFromUrl(parsed.href);
  if (!hostname) {
    return { ok: false, reason: 'Invalid URL hostname' };
  }

  if (isBlockedDomain(hostname)) {
    return { ok: false, reason: 'Domain is not allowed' };
  }

  // Fast path — same URLs that work when pasted via "הדבק קישור"
  if (isWikimediaUploadUrl(normalized)) {
    return { ok: true, url: normalized, contentType: 'image/*' };
  }
  if (isWikimediaFilePathUrl(normalized)) {
    return { ok: true, url: normalized, contentType: 'image/*' };
  }

  return probeImageUrl(parsed.href);
}

export function isBlockedImageDomain(url: string): boolean {
  const hostname = hostnameFromUrl(url);
  return hostname ? isBlockedDomain(hostname) : true;
}

export type ValidateExternalImageUrlResult = ResolveExternalImageUrlResult;

export async function validateExternalImageUrl(
  rawUrl: string,
): Promise<ValidateExternalImageUrlResult> {
  return resolveExternalImageUrl(rawUrl);
}
