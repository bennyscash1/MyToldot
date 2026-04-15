import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter, Heebo } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { routing, isValidLocale, type Locale } from '@/i18n/routing';
import { LOCALE_DIR } from '@/types';
import { Navbar } from '@/components/layout/Navbar';
import '@/app/globals.css';

// ──────────────────────────────────────────────
// Fonts
// Inter  → English (Latin)
// Heebo  → Hebrew (Latin + Hebrew subsets)
// Both are loaded upfront; we apply the correct
// className to <html> based on the active locale.
// ──────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['latin', 'hebrew'],
  variable: '--font-heebo',
  display: 'swap',
});

// ──────────────────────────────────────────────
// Static params — tell Next.js which locales to
// pre-render at build time (SSG / ISR).
// ──────────────────────────────────────────────

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// ──────────────────────────────────────────────
// Metadata
// ──────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    template: '%s | ShorTree',
    default: 'ShorTree — Family Tree',
  },
  description: 'Discover, connect, and preserve your family history.',
};

// ──────────────────────────────────────────────
// Layout
// ──────────────────────────────────────────────

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  // Guard: show 404 for any unknown locale segment.
  if (!isValidLocale(locale)) {
    notFound();
  }

  // Validate as the correct type after the guard.
  const safeLocale = locale as Locale;

  // Load messages on the server — passed to the client provider below.
  const messages = await getMessages();

  const dir = LOCALE_DIR[safeLocale];
  const fontClass = safeLocale === 'he' ? heebo.className : inter.className;

  return (
    <html lang={safeLocale} dir={dir} className={fontClass}>
      <body className="flex min-h-screen flex-col bg-white">
        <NextIntlClientProvider messages={messages}>
          {/* ── Persistent top navigation ── */}
          <Navbar />

          {/* ── Page content ── */}
          <main className="flex-1">{children}</main>

          {/* ── Footer placeholder (Phase 2 — kept minimal) ── */}
          <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} ShorTree
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
