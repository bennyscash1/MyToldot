import type { ReactNode } from 'react';

// ──────────────────────────────────────────────
// Root layout — intentionally minimal.
// The real <html> and <body> setup (lang, dir,
// fonts, providers) lives in [locale]/layout.tsx
// so it has access to the active locale.
// Next.js 14+ App Router supports this pattern.
// ──────────────────────────────────────────────

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
