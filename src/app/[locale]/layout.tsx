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
  const dir        = LOCALE_DIR[safeLocale];
  const fontClass  = safeLocale === 'he' ? heebo.className : inter.className;

  return (
    <html lang={safeLocale} dir={dir} className={fontClass}>
      {/*
        suppressHydrationWarning on <body>:
        Browser extensions (Grammarly, Testim, LastPass, etc.) inject
        their own attributes into <body> after SSR. React then sees a
        mismatch and throws a hydration error we cannot prevent from our
        code. suppressHydrationWarning tells React to accept any attribute
        mismatch on this single element; children still hydrate normally.
      */}
      <body
        className="flex min-h-screen flex-col overflow-x-hidden bg-white"
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} Family Tree
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
