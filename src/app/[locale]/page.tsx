import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';

import { Link } from '@/i18n/routing';
import { getAuthUser } from '@/lib/api/auth';
import { JoinFamilySection } from '@/components/features/tree/JoinFamilySection';

// ──────────────────────────────────────────────
// Home Page — Server Component.
//
// Anonymous visitors see the public hero + signup/login CTAs.
// Authenticated users see "Start Your Family Tree" + the join-by-code
// section. There is no global approval state — editing rights are
// enforced per-tree inside each /tree/[shortCode] view.
// ──────────────────────────────────────────────

export const metadata: Metadata = { title: { absolute: 'Toldotay' } };

export default async function HomePage({ params }: LocalePageProps) {
  const { locale } = await params;
  const t       = await getTranslations('home');
  const tAuth   = await getTranslations('auth');
  const isHebrew = locale === 'he';
  const logoSrc = isHebrew ? '/images/LOGO-he.png' : '/images/LOGO-en.png';
  const logoAlt = isHebrew ? 'תולדותיי' : 'Toldotay';

  const user = await getAuthUser();

  return (
    <section className="flex h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <Image
        src={logoSrc}
        alt={logoAlt}
        width={420}
        height={72}
        className="h-auto w-full max-w-[260px] sm:max-w-[360px] md:max-w-[420px]"
        priority
      />

      <h1 className="max-w-2xl text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
        {t('title')}
      </h1>

      <p className="max-w-xl text-base text-gray-500 sm:text-lg">{t('subtitle')}</p>

      {user ? (
        /* Logged-in: primary = create tree, secondary = view tree */
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/tree/setup"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            {t('createTree')}
          </Link>
          <Link
            href="/tree"
            className="rounded-xl border border-emerald-600 px-6 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            {t('cta')}
          </Link>
        </div>
      ) : (
        /* Guest: primary = sign up, secondary = log in */
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            {t('getStarted')}
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-emerald-600 px-6 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
          >
            {tAuth('loginLink')}
          </Link>
        </div>
      )}

      {user && (
        <div className="mt-6 w-full max-w-lg px-2">
          <JoinFamilySection />
        </div>
      )}
    </section>
  );
}
