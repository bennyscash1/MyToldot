import 'server-only';

import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/api/errors';
import { requireAuthUser } from '@/lib/api/auth';

/**
 * Payload the FamilyTreeViewer (RSC → Client) is hydrated with on first load.
 * Dates are kept as `Date` instances here; serialization to the client boundary
 * is handled by React's server→client payload encoder.
 */
export interface TreeViewerPayload {
  tree: {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    root_person_id: string | null;
  };
  persons: Array<{
    id: string;
    first_name: string;
    last_name: string | null;
    maiden_name: string | null;
    first_name_he: string | null;
    last_name_he: string | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
    birth_date: Date | null;
    death_date: Date | null;
    birth_place: string | null;
    profile_image: string | null;
  }>;
  relationships: Array<{
    id: string;
    relationship_type: 'SPOUSE' | 'PARENT_CHILD' | 'SIBLING' | 'ENGAGED' | 'DIVORCED' | 'ADOPTED_PARENT';
    person1_id: string;
    person2_id: string;
    start_date: Date | null;
    end_date: Date | null;
  }>;
  viewer: {
    user_id: string;
    role: 'VIEWER' | 'EDITOR_PENDING' | 'EDITOR' | 'OWNER';
    linked_person_id: string | null;
  };
  /** Resolved focal person for the initial render: linked_person → root_person → first person → null. */
  initial_focal_person_id: string | null;
}

/**
 * Loads everything the client needs to render a tree in one round-trip.
 * Throws 401/403/404 — caller should let the Next.js error boundary / notFound
 * handle it, or catch and render a gate page.
 */
export async function getTreeViewerPayload(treeId: string): Promise<TreeViewerPayload> {
  const user = await requireAuthUser();

  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: {
      id: true,
      name: true,
      description: true,
      is_public: true,
      root_person_id: true,
    },
  });
  if (!tree) throw Errors.notFound('Tree');

  const membership = await prisma.treeMember.findUnique({
    where: { tree_id_user_id: { tree_id: treeId, user_id: user.id } },
    select: { role: true, linked_person_id: true },
  });

  // Public trees are readable by anyone; private trees require membership.
  if (!membership && !tree.is_public) throw Errors.forbidden();

  const [persons, relationships] = await Promise.all([
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
        profile_image: true,
      },
      orderBy: { created_at: 'asc' }, // stable order for non-member public viewers
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

  const initial_focal_person_id =
    membership?.linked_person_id ??
    tree.root_person_id ??
    persons[0]?.id ??
    null;

  return {
    tree,
    persons,
    relationships,
    viewer: {
      user_id: user.id,
      role: membership?.role ?? 'VIEWER', // public-tree non-members get read-only
      linked_person_id: membership?.linked_person_id ?? null,
    },
    initial_focal_person_id,
  };
}
