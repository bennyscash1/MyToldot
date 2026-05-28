import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import { findTreeByRouteParam } from '@/server/services/tree.service';
import { getDashboardData } from '@/server/queries/dashboard.queries';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

type DashboardPageProps = {
  params: Promise<{ locale: string; shortCode: string }>;
  searchParams: Promise<{ personId?: string }>;
};

export async function generateMetadata({
  params,
}: DashboardPageProps): Promise<Metadata> {
  const { shortCode } = await params;
  const tree = await findTreeByRouteParam(shortCode);
  const t = await getTranslations('dashboard');
  return {
    title: t('metaTitle', { treeName: tree?.name ?? shortCode }),
  };
}

export default async function TreeDashboardRoute({
  params,
  searchParams,
}: DashboardPageProps) {
  const { shortCode } = await params;
  const { personId } = await searchParams;
  const tree = await findTreeByRouteParam(shortCode);
  if (!tree) notFound();

  const data = await getDashboardData(tree.id);
  if (!data) notFound();

  return <DashboardPage data={data} initialPersonId={personId ?? null} />;
}
