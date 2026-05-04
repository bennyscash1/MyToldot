import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { LocalePageProps } from '@/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Link } from '@/i18n/routing';
import { SetupRootFlow } from '@/components/features/persons/SetupRootFlow';

// ──────────────────────────────────────────────
// Setup Root Person Page — Server Component
//
// URL: /[locale]/setup-root
//
// Server-side responsibilities:
//  1. Validate the user session.
//  2. Check whether the user already owns a tree (OWNER only — not viewer on others’ trees).
//  3. Pass resolved data as props to SetupRootFlow
//     (Client Component) — no client-side loading states
//     needed for the initial render.
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('setup');
  return { title: t('pageTitle') };
}

export default async function SetupRootPage({ params }: LocalePageProps) {
  const { locale } = await params;
  const t = await getTranslations('setup');

  // ── 1. Resolve auth ──
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — show a gentle prompt (login page arrives with auth UI).
  if (!user) {
    return (
      <SetupShell title={t('pageTitle')} subtitle={t('pageSubtitle')}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-gray-500">{t('notLoggedIn')}</p>
          <Link
            href="/"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline"
          >
            {t('goHome')}
          </Link>
        </div>
      </SetupShell>
    );
  }

  // ── 2. Owned tree only (users may also be VIEWER on someone else’s tree) ──
  let treeId: string | null = null;
  let treeRouteCode: string | null = null;
  let personCount = 0;

  try {
    const ownerMembership = await prisma.treeMember.findFirst({
      where:   { user_id: user.id, role: 'OWNER' },
      orderBy: { joined_at: 'asc' },
      select: {
        tree: {
          select: {
            id: true,
            shortCode: true,
            slug: true,
            _count: { select: { persons: true } },
          },
        },
      },
    });

    const tree = ownerMembership?.tree ?? null;
    treeId = tree?.id ?? null;
    treeRouteCode = tree?.shortCode ?? tree?.slug ?? null;
    personCount = tree?._count.persons ?? 0;
  } catch {
    // DB unavailable in local dev — continue with onboarding UI.
  }

  // Owned tree exists but nobody added yet — first person is added on the tree canvas.
  if (treeId && personCount === 0) {
    if (treeRouteCode) redirect(`/${locale}/tree/${treeRouteCode}`);
    redirect(`/${locale}/tree`);
  }

  // User owns a tree that already has people — no need to re-run setup.
  if (treeId && personCount > 0) {
    return (
      <SetupShell title={t('pageTitle')} subtitle={t('pageSubtitle')}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="h-8 w-8 text-emerald-600"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="font-medium text-gray-800">{t('alreadySetup')}</p>
          <Link
            href={treeRouteCode ? `/tree/${treeRouteCode}` : '/tree'}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            {t('viewTree')}
          </Link>
        </div>
      </SetupShell>
    );
  }

  // ── 3. Render the interactive setup flow ──
  return (
    <SetupShell title={t('pageTitle')} subtitle={t('pageSubtitle')}>
      <SetupRootFlow />
    </SetupShell>
  );
}

// ── Layout shell (keeps the page DRY across all states) ──

function SetupShell({
  title,
  subtitle,
  children,
}: {
  title:    string;
  subtitle: string;
  children: React.ReactNode;
}) {
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
          {title}
        </h1>
        <p className="mt-2 text-gray-500">{subtitle}</p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
