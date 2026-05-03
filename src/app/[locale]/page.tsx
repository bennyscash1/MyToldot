import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';

import { Link } from '@/i18n/routing';
import { getCurrentUserWithProfile } from '@/lib/api/auth';
import { JoinFamilySection } from '@/components/features/tree/JoinFamilySection';

// ──────────────────────────────────────────────
// Home Page — Server Component.
//
// Anonymous visitors see the public hero + a "View Family Tree"
// CTA. Authenticated users additionally see:
//  • A "Pending approval" banner if their account hasn't been
//    approved by an admin yet.
//  • The JoinFamilySection to enter an existing tree by code.
//
// Adding persons is intentionally not available here — it belongs
// inside the specific tree view (/tree/[shortCode]) where the
// correct tree context is always known.
// ──────────────────────────────────────────────

export const metadata: Metadata = { title: { absolute: 'Toldotay' } };

export default async function HomePage({ params }: LocalePageProps) {
  const { locale } = await params;
  const t       = await getTranslations('home');
  const tAuth   = await getTranslations('auth');
  const isHebrew = locale === 'he';
  const logoSrc = isHebrew ? '/images/LOGO-he.png' : '/images/LOGO-en.png';
  const logoAlt = isHebrew ? 'תולדותיי' : 'Toldotay';

  const session = await getCurrentUserWithProfile();
  const profile = session?.profile ?? null;
  const isPending =
    !!session && (!profile?.is_approved || profile.access_role === 'GUEST');

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

      {/* Pending-approval banner (auth users only) */}
      {isPending && (
        <Link
          href="/pending-approval"
          className="flex max-w-xl items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{tAuth('pendingBadge')}:</span>
          <span className="truncate">{tAuth('pendingMessage')}</span>
        </Link>
      )}

      {session ? (
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

      {session && (
        <div className="mt-6 w-full max-w-lg px-2">
          <JoinFamilySection />
        </div>
      )}
    </section>
  );
}
