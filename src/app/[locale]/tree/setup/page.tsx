import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

// Legacy URL: owned tree → that tree; otherwise → setup-root (e.g. viewer-only members).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('setup');
  return { title: t('pageTitle') };
}

export default async function TreeSetupPage({ params }: LocalePageProps) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  let treeRouteCode: string | null = null;

  try {
    const ownerMembership = await prisma.treeMember.findFirst({
      where: { user_id: user.id, role: 'OWNER' },
      orderBy: { joined_at: 'asc' },
      select: {
        tree: {
          select: {
            shortCode: true,
            slug: true,
          },
        },
      },
    });

    if (ownerMembership?.tree) {
      treeRouteCode = ownerMembership.tree.shortCode ?? ownerMembership.tree.slug;
    }
  } catch {
    // DB unavailable — fall through to setup-root.
  }

  if (treeRouteCode) {
    redirect(`/${locale}/tree/${treeRouteCode}`);
  }

  redirect(`/${locale}/setup-root`);
}
