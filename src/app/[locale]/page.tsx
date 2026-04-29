import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';

import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { getCurrentUserWithProfile } from '@/lib/api/auth';
import { AddPersonSection } from '@/components/features/persons/AddPersonSection';

// ──────────────────────────────────────────────
// Home Page — Server Component.
//
// Anonymous visitors see the public hero + a "View Family Tree"
// CTA. Authenticated users additionally see:
//  • A "Pending approval" banner if their account hasn't been
//    approved by an admin yet, OR
//  • The Add-Person section (gated by the global RBAC).
// ──────────────────────────────────────────────

export const metadata: Metadata = { title: { absolute: 'Toldotay' } };

interface HeroTreeInfo {
  treeId:      string;
  strictMode:  boolean;
  personCount: number;
}

async function loadHeroTreeInfo(): Promise<HeroTreeInfo | null> {
  try {
    const tree = await prisma.tree.findFirst({
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        strict_lineage_enforcement: true,
        _count: { select: { persons: true } },
      },
    });
    if (!tree) return null;
    return {
      treeId:      tree.id,
      strictMode:  tree.strict_lineage_enforcement,
      personCount: tree._count.persons,
    };
  } catch (dbError) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[HomePage] Prisma unavailable, rendering anonymous hero:', dbError);
    }
    return null;
  }
}

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
  const canEdit =
    !!profile?.is_approved &&
    (profile.access_role === 'EDITOR' || profile.access_role === 'ADMIN');

  const heroTree = canEdit ? await loadHeroTreeInfo() : null;

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

      <Link
        href="/tree"
        className="mt-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {t('cta')}
      </Link>

      {/* Add Person — only for approved editors/admins */}
      {canEdit && heroTree && (
        <AddPersonSection
          treeId={heroTree.treeId}
          strictMode={heroTree.strictMode}
          personCount={heroTree.personCount}
        />
      )}
    </section>
  );
}
