import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

import type { LocalePageProps } from '@/types';
import type { ApiEnvelope, TreeAboutDto } from '@/types/api';
import { resolveCurrentTreeId } from '@/server/services/tree.service';
import { AboutSection } from '@/features/about/components/AboutSection';
import { getCurrentUserTreeRole } from '@/lib/api/auth';

// ──────────────────────────────────────────────
// /[locale]/about — Family heritage description.
//
// Server Component. Resolves the current tree, fetches its
// about_text + main_surnames, and hydrates the client section.
//
// `canEdit` is derived from the caller's PER-TREE role on the
// resolved tree (EDITOR or OWNER). Guests and VIEWERs see
// read-only content.
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aboutPage');
  return { title: t('title') };
}

export default async function AboutPage({ params }: LocalePageProps) {
  await params; // locale handled by layout
  const t = await getTranslations('aboutPage');

  const treeId = await resolveCurrentTreeId();

  if (!treeId) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('title')}
        </h1>
        <p className="mt-4 text-gray-500">{t('noTree')}</p>
      </section>
    );
  }

  let initial: TreeAboutDto = {
    id: treeId,
    about_text: null,
    main_surnames: [],
  };

  try {
    initial = await fetchAbout(treeId);
  } catch {
    // Fall through with empty defaults — the section renders
    // its own empty state and the editor still works.
  }

  // Per-tree RBAC: only EDITOR or OWNER on this tree can edit.
  const role = await getCurrentUserTreeRole(treeId);
  const canEdit = role === 'EDITOR' || role === 'OWNER';

  return (
    <AboutSection treeId={treeId} initial={initial} canEdit={canEdit} />
  );
}

async function fetchAbout(treeId: string): Promise<TreeAboutDto> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  if (!host) {
    throw new Error('Missing host header');
  }

  const res = await fetch(`${proto}://${host}/api/v1/trees/${treeId}/about`, {
    cache: 'no-store',
    headers: {
      cookie: hdrs.get('cookie') ?? '',
      accept: 'application/json',
    },
  });

  const envelope = (await res.json()) as ApiEnvelope<TreeAboutDto>;
  if (envelope.error !== null) {
    throw new Error(envelope.error.message);
  }
  return envelope.data;
}
