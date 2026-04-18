import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { LocalePageProps } from '@/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { EmptyTreeState } from '@/components/features/tree/EmptyTreeState';
import { TreeCanvasWithModals } from '@/features/family-tree/components/TreeCanvasWithModals';
import type { PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';

// ──────────────────────────────────────────────
// /[locale]/tree — Family Tree Dashboard
//
// Server Component — resolves all data before render.
//
// States:
//  A. Not logged in       → redirect /login
//  B. No tree             → "no tree" empty state  → /setup-root
//  C. Tree, 0 persons     → "empty tree" state     → /tree/setup
//  D. Tree, 1+ persons    → tree canvas (Phase 5 placeholder)
// ──────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('treePage');
  return { title: t('title') };
}

export default async function TreePage({ params }: LocalePageProps) {
  await params;

  // ── A. Auth guard ──
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // ── Resolve tree + membership role ──
  let treeId: string | null = null;
  let treeName: string | null = null;
  let personCount = 0;
  let membershipRole: 'VIEWER' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN' | null = null;
  let rootPersonId: string | null = null;
  let linkedPersonId: string | null = null;

  try {
    const membership = await prisma.treeMember.findFirst({
      where: { user_id: user.id },
      orderBy: { joined_at: 'asc' },
      select: {
        role: true,
        linked_person_id: true,
        tree: {
          select: {
            id: true,
            name: true,
            root_person_id: true,
            _count: { select: { persons: true } },
          },
        },
      },
    });

    if (membership?.tree) {
      treeId = membership.tree.id;
      treeName = membership.tree.name;
      personCount = membership.tree._count.persons;
      membershipRole = membership.role;
      rootPersonId = membership.tree.root_person_id;
      linkedPersonId = membership.linked_person_id;
    }
  } catch {
    // DB unavailable — fall through to "no tree" state
  }

  // ── B. No tree ──
  if (!treeId) {
    return (
      <TreeShell>
        <EmptyTreeState mode="noTree" />
      </TreeShell>
    );
  }

  // ── C. Tree exists but has no people ──
  if (personCount === 0) {
    return (
      <TreeShell>
        <EmptyTreeState mode="emptyTree" />
      </TreeShell>
    );
  }

  // ── D. Tree has people — interactive canvas ──
  let initialPersons: PersonRow[] = [];
  let initialRelationships: RelationshipRow[] = [];

  try {
    const [personRows, relRows] = await Promise.all([
      prisma.person.findMany({
        where: { tree_id: treeId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          maiden_name: true,
          first_name_he: true,
          last_name_he: true,
          gender: true,
          birth_date: true,
          death_date: true,
          birth_place: true,
          bio: true,
          profile_image: true,
        },
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      }),
      prisma.relationship.findMany({
        where: { tree_id: treeId },
        select: {
          id: true,
          relationship_type: true,
          person1_id: true,
          person2_id: true,
          start_date: true,
          end_date: true,
        },
      }),
    ]);

    initialPersons = personRows.map((p) => ({
      ...p,
      bio: p.bio ?? null,
    }));

    initialRelationships = relRows.map((r) => ({
      id: r.id,
      relationship_type: r.relationship_type as RelationshipRow['relationship_type'],
      person1_id: r.person1_id,
      person2_id: r.person2_id,
      start_date: r.start_date,
      end_date: r.end_date,
    }));
  } catch {
    return (
      <TreeShell>
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-center text-slate-500" dir="rtl">
          לא ניתן לטעון את נתוני העץ. נסו שוב מאוחר יותר.
        </div>
      </TreeShell>
    );
  }

  const initialFocalId =
    linkedPersonId ?? rootPersonId ?? initialPersons[0]?.id ?? null;

  const canEdit =
    membershipRole === 'EDITOR' ||
    membershipRole === 'ADMIN' ||
    membershipRole === 'SUPER_ADMIN';
  const canDeletePerson =
    membershipRole === 'ADMIN' || membershipRole === 'SUPER_ADMIN';

  return (
    <TreeShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2"
          dir="rtl"
        >
          <h1 className="text-sm font-medium text-slate-800">{treeName}</h1>
        </header>
        <div className="min-h-0 flex-1">
          <TreeCanvasWithModals
            treeId={treeId}
            initialPersons={initialPersons}
            initialRelationships={initialRelationships}
            initialFocalId={initialFocalId}
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
