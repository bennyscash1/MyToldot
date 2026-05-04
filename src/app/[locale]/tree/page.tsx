import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LocalePageProps } from '@/types';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/api/auth';
import { Link } from '@/i18n/routing';
import { JoinFamilySection } from '@/components/features/tree/JoinFamilySection';
import { FamilySelector } from '@/components/features/tree/FamilySelector';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Family Tree' };
}

export default async function TreePage({ params }: LocalePageProps) {
  const { locale } = await params;
  const user = await getAuthUser();

  if (user) {
    const memberships = await prisma.treeMember.findMany({
      where: { user_id: user.id },
      orderBy: { joined_at: 'asc' },
      select: {
        role: true,
        tree: { select: { shortCode: true, slug: true, name: true } },
      },
    });

    // ── Exactly 1 family: go straight to it ────────────────────────────────
    if (memberships.length === 1) {
      const code = memberships[0].tree.shortCode ?? memberships[0].tree.slug;
      if (code) redirect(`/${locale}/tree/${code}`);
    }

    // ── 2+ families: show the selector ─────────────────────────────────────
    if (memberships.length >= 2) {
      const families = memberships.map((m) => ({
        shortCode: m.tree.shortCode,
        name: m.tree.name,
        role: m.role,
      }));
      return <FamilySelector families={families} />;
    }

    // ── 0 families: show Create / Join landing ──────────────────────────────
    const t = await getTranslations('familyHub');
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
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

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {t('noFamiliesTitle')}
          </h1>
          <p className="max-w-md text-gray-500">{t('noFamiliesSubtitle')}</p>
        </div>

        <Link
          href="/setup-root"
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          {t('createTree')}
        </Link>

        <div className="w-full max-w-lg">
          <p className="mb-3 text-sm text-slate-500">{t('joinWithCode')}</p>
          <JoinFamilySection />
        </div>
      </div>
    );
  }

  // ── Guest (not logged in): redirect to first public tree or setup ────────
  const firstPublic = await prisma.tree.findFirst({
    where: { is_public: true },
    orderBy: { created_at: 'asc' },
    select: { shortCode: true, slug: true },
  });
  const publicCode = firstPublic?.shortCode ?? firstPublic?.slug;
  if (publicCode) redirect(`/${locale}/tree/${publicCode}`);

  redirect(`/${locale}/setup-root`);
}
