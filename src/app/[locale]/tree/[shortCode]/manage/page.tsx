import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { prisma } from '@/lib/prisma';
import { getAuthUser, getCurrentUserTreeRole } from '@/lib/api/auth';
import { findTreeByRouteParam } from '@/server/services/tree.service';
import {
  FamilyManageMembersTable,
  type FamilyMemberRow,
} from '@/components/features/tree/FamilyManageMembersTable';

type ManagePageProps = {
  params: Promise<{ locale: string; shortCode: string }>;
};

export async function generateMetadata({ params }: ManagePageProps): Promise<Metadata> {
  await params;
  const t = await getTranslations('familyManage');
  return { title: t('pageTitle') };
}

export default async function FamilyManagePage({ params }: ManagePageProps) {
  const { locale, shortCode } = await params;
  const t = await getTranslations('familyManage');

  const tree = await findTreeByRouteParam(shortCode);
  if (!tree) notFound();

  const user = await getAuthUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }

  const role = await getCurrentUserTreeRole(tree.id);
  if (role !== 'OWNER') {
    redirect(`/${locale}/tree/${shortCode}`);
  }

  const rows = await prisma.treeMember.findMany({
    where: { tree_id: tree.id },
    orderBy: { joined_at: 'asc' },
    include: {
      user: { select: { id: true, email: true, full_name: true } },
    },
  });

  const members: FamilyMemberRow[] = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: r.user.email,
    fullName: r.user.full_name,
    joinedAt: r.joined_at.toISOString(),
    role: r.role,
  }));

  return (
    <div className="min-h-0 flex-1 bg-[#f4f3e9]" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <header className="border-b border-slate-200/60 bg-white/80 px-4 py-6 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('pageTitle')}
          </h1>
          <p className="mt-1 text-slate-600">{t('pageSubtitle', { name: tree.name })}</p>
        </div>
      </header>
      <FamilyManageMembersTable
        treeRouteSegment={shortCode}
        locale={locale}
        members={members}
      />
    </div>
  );
}
