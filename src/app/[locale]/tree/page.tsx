import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/api/auth';

// Legacy entry point:
// `/[locale]/tree` now redirects to the canonical slug route:
// `/[locale]/tree/[shortCode]` (4-digit code; legacy slug still resolves).

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Tree' };
}

export default async function TreePage({ params }: LocalePageProps) {
  const { locale } = await params;
  const user = await getAuthUser();

  if (user) {
    const membership = await prisma.treeMember.findFirst({
      where: { user_id: user.id },
      orderBy: { joined_at: 'asc' },
      select: { tree: { select: { shortCode: true, slug: true } } },
    });
    const memberCode = membership?.tree?.shortCode ?? membership?.tree?.slug;
    if (memberCode) {
      redirect(`/${locale}/tree/${memberCode}`);
    }
  }

  const firstPublic = await prisma.tree.findFirst({
    where: { is_public: true },
    orderBy: { created_at: 'asc' },
    select: { shortCode: true, slug: true },
  });
  const publicCode = firstPublic?.shortCode ?? firstPublic?.slug;
  if (publicCode) {
    redirect(`/${locale}/tree/${publicCode}`);
  }

  redirect(`/${locale}/tree/setup`);
}
