import { prisma } from '@/lib/prisma';

const CURRENT_SPOUSE_TYPES = ['SPOUSE', 'ENGAGED'] as const;

type SpouseRel = {
  id: string;
  person1_id: string;
  person2_id: string;
  start_date: Date | null;
};

function spouseSortKeyDesc(r: SpouseRel): { date: number; tie: string } {
  const raw = r.start_date;
  const date =
    raw == null
      ? Number.MIN_SAFE_INTEGER
      : new Date(raw).getTime();
  return {
    date: Number.isNaN(date) ? Number.MIN_SAFE_INTEGER : date,
    tie: r.id,
  };
}

/**
 * Resolves which parent person IDs should receive PARENT_CHILD edges when adding
 * a child. Auto-links the anchor parent's current spouse when unambiguous.
 */
export async function resolveCoParentIds(
  treeId: string,
  parent1Id: string,
  options: { parent2Id?: string | null; skipSpouseAutoLink?: boolean } = {},
): Promise<string[]> {
  const { parent2Id = null, skipSpouseAutoLink = false } = options;

  if (parent2Id) {
    return [parent1Id, parent2Id];
  }

  if (skipSpouseAutoLink) {
    return [parent1Id];
  }

  const spouseRels = await prisma.relationship.findMany({
    where: {
      tree_id: treeId,
      relationship_type: { in: [...CURRENT_SPOUSE_TYPES] },
      OR: [{ person1_id: parent1Id }, { person2_id: parent1Id }],
    },
    select: {
      id: true,
      person1_id: true,
      person2_id: true,
      start_date: true,
    },
  });

  if (spouseRels.length === 0) {
    return [parent1Id];
  }

  const bySpouse = new Map<string, SpouseRel>();
  for (const r of spouseRels) {
    const other = r.person1_id === parent1Id ? r.person2_id : r.person1_id;
    const key = spouseSortKeyDesc(r);
    const prev = bySpouse.get(other);
    if (!prev || key.date > spouseSortKeyDesc(prev).date ||
      (key.date === spouseSortKeyDesc(prev).date && key.tie > spouseSortKeyDesc(prev).tie)) {
      bySpouse.set(other, r);
    }
  }

  const spouses = [...bySpouse.keys()];
  if (spouses.length === 1) {
    return [parent1Id, spouses[0]];
  }

  const ranked = [...bySpouse.entries()].sort((a, b) => {
    const ka = spouseSortKeyDesc(a[1]);
    const kb = spouseSortKeyDesc(b[1]);
    return kb.date - ka.date || kb.tie.localeCompare(ka.tie);
  });

  console.warn(
    `[co-parent] treeId=${treeId} parent1Id=${parent1Id}: multiple current spouses (${spouses.length}); using most recent co-parent ${ranked[0][0]}`,
  );

  return [parent1Id, ranked[0][0]];
}
