import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { ApiEnvelope } from '@/types/api';
import { EmptyTreeState } from '@/components/features/tree/EmptyTreeState';
import { TreeCanvasWithModals } from '@/features/family-tree/components/TreeCanvasWithModals';
import type { PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';
import type { TreePageData } from '@/server/services/tree.service';
import { getCurrentUserWithProfile } from '@/lib/api/auth';

type TreeShortCodePageProps = {
  params: Promise<{ locale: string; shortCode: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('treePage');
  return { title: t('title') };
}

export default async function TreeShortCodePage({ params }: TreeShortCodePageProps) {
  const { locale, shortCode } = await params;
  let treeData: TreePageData;
  try {
    treeData = await fetchTreeData(locale, shortCode);
  } catch {
    return (
      <TreeShell>
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-center text-slate-500" dir="rtl">
          לא ניתן לטעון את נתוני העץ. נסו שוב מאוחר יותר.
        </div>
      </TreeShell>
    );
  }

  const session = await getCurrentUserWithProfile();
  const profile = session?.profile ?? null;
  const approvedNonGuest =
    !!profile?.is_approved && profile.access_role !== 'GUEST';
  const treeRole = treeData.membershipRole;
  const canEditTree =
    approvedNonGuest &&
    (treeRole === 'EDITOR' || treeRole === 'OWNER');
  const canDeletePerson =
    approvedNonGuest &&
    profile?.access_role === 'ADMIN' &&
    treeRole === 'OWNER';

  if (!treeData.treeId) {
    return (
      <TreeShell>
        <EmptyTreeState mode="noTree" />
      </TreeShell>
    );
  }

  return (
    <TreeShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <TreeCanvasWithModals
            treeId={treeData.treeId}
            treeRouteCode={shortCode}
            initialPersons={treeData.initialPersons}
            initialRelationships={treeData.initialRelationships}
            initialFocalId={treeData.initialFocalId}
            canEdit={canEditTree}
            canDeletePerson={canDeletePerson}
          />
        </div>
      </div>
    </TreeShell>
  );
}

function TreeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {children}
    </div>
  );
}

async function fetchTreeData(locale: string, shortCode: string): Promise<TreePageData> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  if (!host) throw new Error('Missing host header');

  const res = await fetch(`${proto}://${host}/${locale}/tree/${shortCode}/data`, {
    cache: 'no-store',
    headers: {
      cookie: hdrs.get('cookie') ?? '',
      accept: 'application/json',
    },
  });

  const envelope = (await res.json()) as ApiEnvelope<TreePageData>;
  if (envelope.error !== null) {
    throw new Error(envelope.error.message);
  }
  return {
    ...envelope.data,
    initialPersons: envelope.data.initialPersons as PersonRow[],
    initialRelationships: envelope.data.initialRelationships as RelationshipRow[],
  };
}
