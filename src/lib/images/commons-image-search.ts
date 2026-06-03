import type { ImageCandidate } from '@/features/family-tree/schemas/person-image-search.schema';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const FETCH_TIMEOUT_MS = 10000;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

interface CommonsSearchPage {
  title?: string;
  index?: number;
  imageinfo?: Array<{ url?: string; descriptionurl?: string }>;
}

function isLatinQuery(query: string): boolean {
  return /[a-zA-Z]/.test(query);
}

async function fetchCommonsSearch(query: string, limit: number): Promise<CommonsSearchPage[]> {
  const apiUrl = new URL(COMMONS_API);
  apiUrl.searchParams.set('action', 'query');
  apiUrl.searchParams.set('generator', 'search');
  apiUrl.searchParams.set('gsrsearch', query);
  apiUrl.searchParams.set('gsrnamespace', '6');
  apiUrl.searchParams.set('gsrlimit', String(Math.min(limit, 20)));
  apiUrl.searchParams.set('prop', 'imageinfo');
  apiUrl.searchParams.set('iiprop', 'url');
  apiUrl.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl.href, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Toldotay/1.0 (commons-image-search)' },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as {
      query?: { pages?: Record<string, CommonsSearchPage> };
    };

    return Object.values(data.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 999) - (b.index ?? 999),
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function pageToCandidate(page: CommonsSearchPage): ImageCandidate | null {
  const imageUrl = page.imageinfo?.[0]?.url?.trim();
  if (!imageUrl || !IMAGE_EXT.test(imageUrl)) return null;

  const title = page.title?.startsWith('File:') ? page.title.slice(5) : (page.title ?? '');
  return {
    imageUrl,
    sourcePageUrl: page.imageinfo?.[0]?.descriptionurl,
    sourceDomain: 'wikimedia.org',
    caption: title.replace(/_/g, ' '),
    confidence: 'medium',
  };
}

/** Build Latin search queries for Wikimedia Commons (Hebrew-only strings are skipped). */
export function buildCommonsSearchQueries(
  fullNameEn: string | undefined,
  searchContext: string,
): string[] {
  const queries = new Set<string>();

  const en = fullNameEn?.trim();
  if (en) queries.add(en);

  const ctx = searchContext.trim();
  if (ctx && isLatinQuery(ctx)) queries.add(ctx);

  const enLower = en?.toLowerCase() ?? '';
  const first = en?.split(/\s+/)[0];

  if (first) {
    if (/kardashian/i.test(enLower) || /kardashian|קרדש/i.test(ctx.toLowerCase())) {
      queries.add(`${first} Jenner`);
    }
    if (/jenner/i.test(enLower) || /jenner|ג'נר|ג׳נר/i.test(ctx.toLowerCase())) {
      queries.add(`${first} Kardashian`);
    }
    if (/west/i.test(enLower) || /west|ווסט/i.test(ctx)) {
      queries.add(`${first} West`);
    }
  }

  return [...queries].filter(isLatinQuery).slice(0, 5);
}

/** Search Wikimedia Commons directly — returns verified upload.wikimedia.org URLs. */
export async function searchCommonsImageCandidates(
  queries: string[],
  limit: number,
): Promise<ImageCandidate[]> {
  const results: ImageCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    if (results.length >= limit) break;

    const pages = await fetchCommonsSearch(query, limit - results.length + 4);
    for (const page of pages) {
      if (results.length >= limit) break;
      const candidate = pageToCandidate(page);
      if (!candidate || seenUrls.has(candidate.imageUrl)) continue;
      seenUrls.add(candidate.imageUrl);
      results.push(candidate);
    }
  }

  return results;
}
