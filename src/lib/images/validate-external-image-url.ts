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

const FETCH_TIMEOUT_MS = 8000;

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

function isWikimediaHost(hostname: string): boolean {
  return /(^|\.)wikimedia\.org$/i.test(hostname) || /(^|\.)wikipedia\.org$/i.test(hostname);
}

function filenameFromWikimediaUploadPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  const commonsIdx = parts.indexOf('commons');
  if (commonsIdx < 0) return null;

  if (parts[commonsIdx + 1] === 'thumb') {
    const filePart = parts[commonsIdx + 4];
    if (filePart && !/^\d+px-/i.test(filePart)) {
      try {
        return decodeURIComponent(filePart);
      } catch {
        return filePart;
      }
    }
    const last = parts[parts.length - 1];
    if (last && /^\d+px-/i.test(last)) {
      try {
        return decodeURIComponent(last.replace(/^\d+px-/i, ''));
      } catch {
        return last.replace(/^\d+px-/i, '');
      }
    }
  }

  const last = parts[parts.length - 1];
  if (!last || /^\d+px-/i.test(last)) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function filenameFromWikimediaUrl(url: string): string | null {
  if (isWikimediaFilePathUrl(url)) {
    const match = url.match(/\/Special:FilePath\/(.+)$/i);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  if (isWikimediaUploadUrl(url)) {
    try {
      return filenameFromWikimediaUploadPath(new URL(url).pathname);
    } catch {
      return null;
    }
  }
  return null;
}

const commonsUrlCache = new Map<string, string | null>();

export function extractWikimediaFileName(url: string): string | null {
  return filenameFromWikimediaUrl(normalizeExternalImageUrl(url));
}

/** Prefetch Commons CDN URLs for many filenames (one API call). */
export async function prefetchCommonsDirectUrls(fileNames: string[]): Promise<void> {
  const unique = [...new Set(fileNames.map((f) => f.trim()).filter(Boolean))];
  const pending = unique.filter((name) => !commonsUrlCache.has(name));
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i += 40) {
    const chunk = pending.slice(i, i + 40);
    const apiUrl = new URL('https://commons.wikimedia.org/w/api.php');
    apiUrl.searchParams.set('action', 'query');
    apiUrl.searchParams.set('titles', chunk.map((f) => `File:${f}`).join('|'));
    apiUrl.searchParams.set('prop', 'imageinfo');
    apiUrl.searchParams.set('iiprop', 'url');
    apiUrl.searchParams.set('format', 'json');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(apiUrl.href, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Toldotay/1.0 (image-url-validator)' },
      });
      if (!response.ok) continue;

      const data = (await response.json()) as {
        query?: {
          normalized?: Array<{ from?: string; to?: string }>;
          pages?: Record<string, { title?: string; missing?: string; imageinfo?: Array<{ url?: string }> }>;
        };
      };

      const urlByCanonicalTitle = new Map<string, string>();
      for (const page of Object.values(data.query?.pages ?? {})) {
        if (page.missing !== undefined) continue;
        const directUrl = page.imageinfo?.[0]?.url?.trim();
        if (!directUrl || !page.title?.startsWith('File:')) continue;
        urlByCanonicalTitle.set(page.title.slice('File:'.length), directUrl);
      }

      for (const { from, to } of data.query?.normalized ?? []) {
        if (!from?.startsWith('File:') || !to?.startsWith('File:')) continue;
        const directUrl = urlByCanonicalTitle.get(to.slice('File:'.length));
        if (!directUrl) continue;
        commonsUrlCache.set(from.slice('File:'.length), directUrl);
        commonsUrlCache.set(to.slice('File:'.length), directUrl);
      }

      for (const name of chunk) {
        if (!commonsUrlCache.has(name)) {
          commonsUrlCache.set(name, null);
        }
      }
    } catch {
      // leave uncached — single lookups may retry
    } finally {
      clearTimeout(timer);
    }
  }
}

async function lookupCommonsDirectUrl(fileName: string): Promise<string | null> {
  if (commonsUrlCache.has(fileName)) {
    return commonsUrlCache.get(fileName) ?? null;
  }

  await prefetchCommonsDirectUrls([fileName]);
  return commonsUrlCache.get(fileName) ?? null;
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

    if (response.status === 405 || response.status === 403) {
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

/** Verify URL serves an image; for Wikimedia, fix wrong CDN paths via Commons API. */
async function resolveWikimediaUrl(url: string): Promise<ResolveExternalImageUrlResult> {
  const probed = await probeImageUrl(url);
  if (probed.ok) return probed;

  const fileName = filenameFromWikimediaUrl(url);
  if (!fileName) return probed;

  const directUrl = await lookupCommonsDirectUrl(fileName);
  if (!directUrl) return probed;

  return probeImageUrl(directUrl);
}

/**
 * Normalizes wiki page URLs, verifies the target serves image/*, and returns a
 * direct CDN URL suitable for <img src> (with referrerPolicy=no-referrer).
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

  if (isWikimediaHost(hostname) || isWikimediaUploadUrl(normalized) || isWikimediaFilePathUrl(normalized)) {
    return resolveWikimediaUrl(parsed.href);
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
