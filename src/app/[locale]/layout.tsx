import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Cormorant_Garamond, Frank_Ruhl_Libre, Heebo, Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { routing, isValidLocale, type Locale } from '@/i18n/routing';
import { LOCALE_DIR } from '@/types';
import { Navbar } from '@/components/layout/Navbar';
import { ViewportModeSync } from '@/components/layout/ViewportModeSync';
import {
  isLandingRootPathname,
  isTreeCanvasPathname,
} from '@/lib/routing/viewport';
import '@/app/globals.css';

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

const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ['latin', 'hebrew'],
  variable: '--font-frank-ruhl-libre',
  display: 'swap',
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant-garamond',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    template: '%s | Toldotay',
    default: 'Toldotay',
  },
  description: 'Discover, connect, and preserve your family history.',
  icons: {
    icon: '/images/LOGO-en.png',
    shortcut: '/images/LOGO-en.png',
    apple: '/images/LOGO-en.png',
  },
};

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const safeLocale = locale as Locale;
  const messages   = await getMessages();
  const tCommon    = await getTranslations('common');
  const dir        = LOCALE_DIR[safeLocale];
  const fontClass = safeLocale === 'he' ? heebo.className : inter.className;
  const fontVariables = `${frankRuhlLibre.variable} ${cormorantGaramond.variable}`;

  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  const isLockedViewport = isTreeCanvasPathname(pathname);
  const isLandingRoot = isLandingRootPathname(pathname);

  const bodyClass = isLockedViewport
    ? 'flex h-screen flex-col overflow-hidden bg-white'
    : 'flex min-h-screen flex-col overflow-x-hidden bg-white';
  const mainClass = isLockedViewport
    ? 'flex min-h-0 flex-1 flex-col'
    : 'flex-1';

  return (
    <html lang={safeLocale} dir={dir} className={`${fontClass} ${fontVariables}`}>
      {/*
        suppressHydrationWarning on <body>:
        Browser extensions (Grammarly, Testim, LastPass, etc.) inject
        their own attributes into <body> after SSR. React then sees a
        mismatch and throws a hydration error we cannot prevent from our
        code. suppressHydrationWarning tells React to accept any attribute
        mismatch on this single element; children still hydrate normally.
      */}
      <body className={bodyClass} suppressHydrationWarning>
        <NextIntlClientProvider messages={messages}>
          <ViewportModeSync />
          <Navbar />
          <main id="app-main" className={mainClass}>
            {children}
          </main>
          <footer
            id="app-footer"
            hidden={isLockedViewport || isLandingRoot}
            className="border-t border-gray-100 py-6 text-center text-sm text-gray-400"
          >
            {tCommon('footerCopyright', { year: new Date().getFullYear() })}
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
