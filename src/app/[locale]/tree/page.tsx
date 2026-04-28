import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import type { ApiEnvelope } from '@/types/api';
import { EmptyTreeState } from '@/components/features/tree/EmptyTreeState';
import { TreeCanvasWithModals } from '@/features/family-tree/components/TreeCanvasWithModals';
import type { PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';
import type { TreePageData } from '@/server/services/tree.service';
import { getCurrentUserWithProfile } from '@/lib/api/auth';

// ──────────────────────────────────────────────
// /[locale]/tree — Family Tree Dashboard
//
// Server Component — resolves all data before render.
//
// States:
//  A. Not logged in       → redirect /login
//  B. No tree             → "no tree" empty state  → /setup-root
//  C. Tree, 0 persons     → editors: empty canvas + add first person; viewers: empty state
//  D. Tree, 1+ persons    → interactive canvas
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('treePage');
  return { title: t('title') };
}

export default async function TreePage({ params }: LocalePageProps) {
  const { locale } = (await params) as { locale: string };
  let treeData: TreePageData;
  try {
    treeData = await fetchTreeData(locale);
  } catch {
    return (
      <TreeShell>
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-center text-slate-500" dir="rtl">
          לא ניתן לטעון את נתוני העץ. נסו שוב מאוחר יותר.
        </div>
      </TreeShell>
    );
  }

  // RBAC: derive permissions from the global User profile so that SSR
  // already sends the correct add/edit/delete UI in the canvas markup.
  const session = await getCurrentUserWithProfile();
  const profile = session?.profile ?? null;
  const canEdit =
    !!profile?.is_approved &&
    (profile.access_role === 'EDITOR' || profile.access_role === 'ADMIN');
  const canDeletePerson =
    !!profile?.is_approved && profile.access_role === 'ADMIN';

  // ── B. No tree ──
  if (!treeData.treeId) {
    return (
      <TreeShell>
        <EmptyTreeState mode="noTree" />
      </TreeShell>
    );
  }

  // ── C. Tree exists but has no people ──
  if (treeData.personCount === 0) {
    if (!canEdit) {
      return (
        <TreeShell>
          <EmptyTreeState mode="emptyTree" />
        </TreeShell>
      );
    }
    return (
      <TreeShell>
        <div className="flex min-h-0 flex-1 flex-col">
          <header
            className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-[#f4f3e9] px-4 py-2.5"
            dir="rtl"
          >
            <h1 className="text-sm font-medium text-slate-800">{treeData.treeName}</h1>
          </header>
          <div className="min-h-0 flex-1">
            <TreeCanvasWithModals
              treeId={treeData.treeId}
              initialPersons={[]}
              initialRelationships={[]}
              initialFocalId={null}
              canEdit
              canDeletePerson={canDeletePerson}
            />
          </div>
        </div>
      </TreeShell>
    );
  }

  // ── D. Tree has people — interactive canvas ──
  return (
    <TreeShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-[#f4f3e9] px-4 py-2.5"
          dir="rtl"
        >
          <h1 className="text-sm font-medium text-slate-800">{treeData.treeName}</h1>
        </header>
        <div className="min-h-0 flex-1">
          <TreeCanvasWithModals
            treeId={treeData.treeId}
            initialPersons={treeData.initialPersons}
            initialRelationships={treeData.initialRelationships}
            initialFocalId={treeData.initialFocalId}
            canEdit={canEdit}
            canDeletePerson={canDeletePerson}
          />
        </div>
      </div>
    </TreeShell>
  );
}

// ── Layout shell ──────────────────────────────

function TreeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {children}
    </div>
  );
}

async function fetchTreeData(locale: string): Promise<TreePageData> {
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  if (!host) {
    throw new Error('Missing host header');
  }

  const res = await fetch(`${proto}://${host}/${locale}/tree/data`, {
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
  return normalizeTreeData(envelope.data);
}

function normalizeTreeData(data: TreePageData): TreePageData {
  return {
    ...data,
    initialPersons: data.initialPersons as PersonRow[],
    initialRelationships: data.initialRelationships as RelationshipRow[],
  };
}
