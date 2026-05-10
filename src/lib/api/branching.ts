import { prisma } from '@/lib/prisma';

// ──────────────────────────────────────────────
// Branching control ("בקרת הסתעפות")
//
// When `Tree.allow_branching` is false, new persons must connect via
// allowed relationship patterns. See product spec / plan.
// ──────────────────────────────────────────────

const BLOOD_TYPES = ['PARENT_CHILD', 'ADOPTED_PARENT', 'SIBLING'] as const;

export type ProposedConnection =
  | { kind: 'spouse'; anchorId: string }
  | { kind: 'child'; anchorIds: string[]; adoptive?: boolean }
  | { kind: 'parent'; anchorId: string; adoptive?: boolean }
  | { kind: 'sibling'; anchorId: string }
  | { kind: 'standalone' };

export interface BranchingCheckResult {
  allowed: boolean;
  reason?: 'BRANCHING_NOT_ALLOWED';
  ownerEmail?: string;
}

/**
 * Returns whether adding a new person with the proposed connection(s)
 * is allowed under the tree's `allow_branching` policy.
 */
export async function isPersonAllowed(
  treeId: string,
  proposed: ProposedConnection,
): Promise<BranchingCheckResult> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { allow_branching: true, root_person_id: true },
  });

  if (!tree) {
    return { allowed: false, reason: 'BRANCHING_NOT_ALLOWED' };
  }

  if (tree.allow_branching) {
    return { allowed: true };
  }

  switch (proposed.kind) {
    case 'spouse':
    case 'child':
      return { allowed: true };

    case 'sibling':
      if (proposed.anchorId === tree.root_person_id) {
        return { allowed: true };
      }
      return blocked(treeId);

    case 'parent': {
      if (proposed.anchorId === tree.root_person_id) {
        return { allowed: true };
      }
      const isInLaw = await isInLawOnly(treeId, proposed.anchorId);
      return isInLaw ? blocked(treeId) : { allowed: true };
    }

    case 'standalone': {
      const count = await prisma.person.count({ where: { tree_id: treeId } });
      return count === 0 ? { allowed: true } : blocked(treeId);
    }
  }
}

/** In-law = only marriage-type edges, no blood/adoptive/sibling edges. */
async function isInLawOnly(treeId: string, personId: string): Promise<boolean> {
  const rels = await prisma.relationship.findMany({
    where: {
      tree_id: treeId,
      OR: [{ person1_id: personId }, { person2_id: personId }],
    },
    select: { relationship_type: true },
  });

  if (rels.length === 0) {
    return false;
  }

  return !rels.some((r) => (BLOOD_TYPES as readonly string[]).includes(r.relationship_type));
}

async function blocked(treeId: string): Promise<BranchingCheckResult> {
  const owner = await prisma.treeMember.findFirst({
    where: { tree_id: treeId, role: 'OWNER' },
    orderBy: { joined_at: 'asc' },
    select: { user: { select: { email: true } } },
  });

  return {
    allowed: false,
    reason: 'BRANCHING_NOT_ALLOWED',
    ownerEmail: owner?.user.email ?? undefined,
  };
}
