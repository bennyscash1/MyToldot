import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import { Link } from '@/i18n/routing';
// MVP/TESTING — imports below are only needed when auth is active; restore alongside the auth block:
// import { createSupabaseServerClient } from '@/lib/supabase/server';
// import { prisma } from '@/lib/prisma';
// import { AddPersonSection } from '@/components/features/persons/AddPersonSection';

// ──────────────────────────────────────────────
// Home Page — Server Component.
//
// Resolves auth + tree data on the server, passes
// minimal props to the Client Component section.
// This keeps the interactive "Add Person" button
// out of the server bundle while the hero content
// stays statically rendered.
// ──────────────────────────────────────────────

export const metadata: Metadata = { title: 'Home' };

export default async function HomePage({ params }: LocalePageProps) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const isHebrew = locale === 'he';
  const logoSrc = isHebrew ? '/images/LOGO-he.png' : '/images/LOGO-en.png';
  const logoAlt = isHebrew ? 'תולדותיי' : 'Toldotay';

  // MVP/TESTING — auth + tree-membership lookup bypassed.
  // Restore the original block below when auth is re-enabled.
  /* ORIGINAL AUTH BLOCK — restore when auth is re-enabled:
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let treeId:      string | null = null;
  let personCount: number        = 0;
  let strictMode:  boolean       = false;

  if (user) {
    try {
      const membership = await prisma.treeMember.findFirst({
        where:   { user_id: user.id },
        orderBy: { joined_at: 'asc' },
        select:  {
          tree: {
            select: {
              id:                          true,
              strict_lineage_enforcement:  true,
              _count: { select: { persons: true } },
            },
          },
        },
      });

      if (membership?.tree) {
        treeId      = membership.tree.id;
        strictMode  = membership.tree.strict_lineage_enforcement;
        personCount = membership.tree._count.persons;
      }
    } catch (dbError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[HomePage] Prisma unavailable, rendering empty tree state:', dbError);
      } else {
        throw dbError;
      }
    }
  }
  */

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

      {/* MVP/TESTING — CTA goes straight to the tree dashboard.
          Restore the original auth-conditional block below when auth is re-enabled. */}
      <Link
        href="/tree"
        className="mt-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {t('cta')}
      </Link>
      {/* ORIGINAL CTA BLOCK — restore when auth is re-enabled:
      {user ? (
        <AddPersonSection
          treeId={treeId}
          strictMode={strictMode}
          personCount={personCount}
        />
      ) : (
        <div className="flex items-center gap-3 mt-2">
          <Link
            href="/signup"
            className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            {t('addFirstPerson')}
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t('cta')}
          </Link>
        </div>
      )}
      */}
    </section>
  );
}
