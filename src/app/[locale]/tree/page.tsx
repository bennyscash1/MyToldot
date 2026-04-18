import { getTranslations } from 'next-intl/server';
import { redirect }        from 'next/navigation';
import type { Metadata }   from 'next';
import type { LocalePageProps } from '@/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma }  from '@/lib/prisma';
import { Link }    from '@/i18n/routing';
import { EmptyTreeState } from '@/components/features/tree/EmptyTreeState';

// ──────────────────────────────────────────────
// /[locale]/tree — Family Tree Dashboard
//
// Server Component — resolves all data before render.
//
// States:
//  A. Not logged in       → redirect /login
//  B. No tree             → "no tree" empty state  → /setup-root
//  C. Tree, 0 persons     → "empty tree" state     → /tree/setup
//  D. Tree, 1+ persons    → tree canvas (Phase 5 placeholder)
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('treePage');
  return { title: t('title') };
}

export default async function TreePage({ params }: LocalePageProps) {
  await params;
  const t = await getTranslations('treePage');

  // ── A. Auth guard ──
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Resolve tree ──
  let treeId:      string | null = null;
  let treeName:    string | null = null;
  let personCount: number        = 0;

  try {
    const membership = await prisma.treeMember.findFirst({
      where:   { user_id: user.id },
      orderBy: { joined_at: 'asc' },
      select: {
        tree: {
          select: {
            id:   true,
            name: true,
            _count: { select: { persons: true } },
          },
        },
      },
    });

    if (membership?.tree) {
      treeId      = membership.tree.id;
      treeName    = membership.tree.name;
      personCount = membership.tree._count.persons;
    }
  } catch {
    // DB unavailable — fall through to "no tree" state
  }

  // ── B. No tree ──
  if (!treeId) {
    return (
      <TreeShell>
        <EmptyTreeState mode="noTree" />
      </TreeShell>
    );
  }

  // ── C. Tree exists but has no people ──
  if (personCount === 0) {
    return (
      <TreeShell>
        <EmptyTreeState mode="emptyTree" />
      </TreeShell>
    );
  }

  // ── D. Tree has people — Phase 5 canvas placeholder ──
  return (
    <TreeShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
        {/* Phase 5 badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          {treeName}
        </div>

        {/* Canvas placeholder */}
        <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-8 py-16">
          {/* Network / tree icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12 text-gray-300"
            aria-hidden="true"
          >
            <circle cx="12" cy="5"  r="2" />
            <circle cx="5"  cy="19" r="2" />
            <circle cx="19" cy="19" r="2" />
            <line x1="12" y1="7"  x2="5"  y2="17" />
            <line x1="12" y1="7"  x2="19" y2="17" />
            <line x1="5"  y1="17" x2="19" y2="17" />
          </svg>

          <p className="text-sm font-medium text-gray-400">{t('comingSoon')}</p>
          <p className="text-xs text-gray-300">{personCount} {personCount === 1 ? 'person' : 'people'} in your tree</p>
        </div>

        {/* Add another person CTA */}
        <Link
          href="/tree/setup"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <circle cx="9" cy="7" r="4" />
            <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Add Another Person
        </Link>
      </div>
    </TreeShell>
  );
}

// ── Layout shell ──────────────────────────────

function TreeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {children}
    </div>
  );
}
