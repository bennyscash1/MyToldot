import { headers } from 'next/headers';

/** Public site origin for share links and emails (no trailing slash). */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (host) return `${proto}://${host}`;

  return 'https://toldotay.com';
}
