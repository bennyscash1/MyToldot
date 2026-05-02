import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { SetupRootFlow } from '@/components/features/persons/SetupRootFlow';

// ──────────────────────────────────────────────
// /[locale]/tree/setup — Root Person Setup Page
//
// Server Component responsibilities:
//  1. Require authentication → redirect to /login if missing.
//  2. Resolve the user's tree (and person count).
//  3. If tree already has people, redirect to /tree.
//  4. Render SetupRootFlow (the onboarding state machine).
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('setup');
  return { title: t('pageTitle') };
}

export default async function TreeSetupPage({ params }: LocalePageProps) {
  await params;

  // ── 1. Auth guard ──
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── 2. Resolve tree ──
  let treeId:      string | null = null;
  let treeRouteCode: string | null = null;
  let strictMode:  boolean       = false;
  let personCount: number        = 0;

  try {
    const membership = await prisma.treeMember.findFirst({
      where:   { user_id: user.id },
      orderBy: { joined_at: 'asc' },
      select: {
        tree: {
          select: {
            id:                         true,
            shortCode:                  true,
            slug:                       true,
            strict_lineage_enforcement: true,
            _count: { select: { persons: true } },
          },
        },
      },
    });

    if (membership?.tree) {
      treeId      = membership.tree.id;
      treeRouteCode = membership.tree.shortCode ?? membership.tree.slug;
      strictMode  = membership.tree.strict_lineage_enforcement;
      personCount = membership.tree._count.persons;
    }
  } catch {
    // DB unavailable in local dev — render the empty-tree flow.
  }

  // ── 3. Already has people → go to the tree view ──
  if (treeId && personCount > 0) {
    redirect(treeRouteCode ? `/tree/${treeRouteCode}` : '/tree/setup');
  }

  // ── 4. Render the onboarding flow ──
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-8 w-8 text-emerald-600"
            aria-hidden="true"
          >
            <path d="M12 2C9.243 2 7 4.243 7 7c0 1.669.825 3.143 2.083 4.059C7.834 11.748 7 13.278 7 15c0 2.757 2.243 5 5 5s5-2.243 5-5c0-1.722-.834-3.252-2.083-3.941C16.175 10.143 17 8.669 17 7c0-2.757-2.243-5-5-5zm0 16c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3zm0-8c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Add the Root Person
        </h1>
        <p className="mt-2 text-gray-500">
          The anchor of your family tree. You can add more relatives afterward.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <SetupRootFlow
          initialTreeId={treeId}
          initialTreeRouteCode={treeRouteCode}
          strictMode={strictMode}
        />
      </div>
    </div>
  );
}
