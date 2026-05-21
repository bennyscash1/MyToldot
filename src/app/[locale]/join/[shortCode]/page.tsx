import { redirect, notFound } from 'next/navigation';

import { getAuthUser, getCurrentUserTreeRole } from '@/lib/api/auth';
import { joinFamilyByCode } from '@/server/actions/tree.actions';
import { findTreeByRouteParam } from '@/server/services/tree.service';

type JoinPageProps = {
  params: Promise<{ locale: string; shortCode: string }>;
};

export default async function JoinFamilyPage({ params }: JoinPageProps) {
  const { locale, shortCode } = await params;

  const tree = await findTreeByRouteParam(shortCode);
  if (!tree) notFound();

  const user = await getAuthUser();
  if (!user) {
    redirect(
      `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/join/${shortCode}`)}`,
    );
  }

  const role = await getCurrentUserTreeRole(tree.id);
  if (role) {
    redirect(`/${locale}/tree/${shortCode}`);
  }

  const result = await joinFamilyByCode(shortCode);
  if (!result.ok) {
    notFound();
  }

  redirect(`/${locale}/tree/${shortCode}?welcome=1`);
}
