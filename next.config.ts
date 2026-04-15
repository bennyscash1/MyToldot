import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// ──────────────────────────────────────────────
// next-intl plugin wraps the Next.js config.
// The path tells it where the server-side request
// config lives (used by Server Components via
// `getTranslations`, `getLocale`, etc.).
// ──────────────────────────────────────────────

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable strict mode for better React dev warnings.
  reactStrictMode: true,

  images: {
    // Supabase Storage URLs (Phase 4 — listed now so we never forget).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
