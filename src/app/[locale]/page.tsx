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
  await params; // consume params (locale handled by layout)
  const t = await getTranslations('home');

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
    <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:py-36">
      {/* Decorative tree mark */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-9 w-9 text-emerald-600"
          aria-hidden="true"
        >
          <path d="M12 2C9.243 2 7 4.243 7 7c0 1.669.825 3.143 2.083 4.059C7.834 11.748 7 13.278 7 15c0 2.757 2.243 5 5 5s5-2.243 5-5c0-1.722-.834-3.252-2.083-3.941C16.175 10.143 17 8.669 17 7c0-2.757-2.243-5-5-5zm0 16c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3zm0-8c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
        </svg>
      </div>

      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        {t('title')}
      </h1>

      <p className="max-w-xl text-lg text-gray-500">{t('subtitle')}</p>

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
