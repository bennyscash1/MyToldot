import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/api/auth';

// Legacy entry point:
// `/[locale]/tree` now redirects to the canonical slug route:
// `/[locale]/tree/[slug]`.

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
      select: { tree: { select: { slug: true } } },
    });
    if (membership?.tree?.slug) {
      redirect(`/${locale}/tree/${membership.tree.slug}`);
    }
  }

  const firstPublic = await prisma.tree.findFirst({
    where: { is_public: true },
    orderBy: { created_at: 'asc' },
    select: { slug: true },
  });
  if (firstPublic?.slug) {
    redirect(`/${locale}/tree/${firstPublic.slug}`);
  }

  redirect(`/${locale}/tree/setup`);
}
