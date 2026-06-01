import type { RelationshipRow } from './types';

const CURRENT_SPOUSE_TYPES = new Set(['SPOUSE', 'ENGAGED']);

function spouseSortKey(r: RelationshipRow): { date: number; tie: string } {
  const raw = r.start_date;
  const date =
    raw == null
      ? Number.MAX_SAFE_INTEGER
      : new Date(raw).getTime();
  return { date: Number.isNaN(date) ? Number.MAX_SAFE_INTEGER : date, tie: r.id };
}

/** Sort key for picking the most recent spouse relationship (matches server co-parent.ts). */
function spouseSortKeyDesc(r: RelationshipRow): { date: number; tie: string } {
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
 * Parent person IDs for a new child edge — mirrors server `resolveCoParentIds`.
 * Used by optimistic UI so the canvas matches DB without refresh.
 */
export function resolveCoParentIdsForChild(
  parent1Id: string,
  relationships: RelationshipRow[],
  options: { parent2Id?: string | null; skipSpouseAutoLink?: boolean } = {},
): string[] {
  const { parent2Id = null, skipSpouseAutoLink = false } = options;

  if (parent2Id) {
    return [parent1Id, parent2Id];
  }
  if (skipSpouseAutoLink) {
    return [parent1Id];
  }

  const bySpouse = new Map<string, RelationshipRow>();
  for (const r of relationships) {
    if (!CURRENT_SPOUSE_TYPES.has(r.relationship_type)) continue;
    if (r.person1_id !== parent1Id && r.person2_id !== parent1Id) continue;
    const other = r.person1_id === parent1Id ? r.person2_id : r.person1_id;
    const key = spouseSortKeyDesc(r);
    const prev = bySpouse.get(other);
    if (
      !prev ||
      key.date > spouseSortKeyDesc(prev).date ||
      (key.date === spouseSortKeyDesc(prev).date && key.tie > spouseSortKeyDesc(prev).tie)
    ) {
      bySpouse.set(other, r);
    }
  }

  const spouses = [...bySpouse.keys()];
  if (spouses.length === 0) {
    return [parent1Id];
  }
  if (spouses.length === 1) {
    return [parent1Id, spouses[0]];
  }

  const ranked = [...bySpouse.entries()].sort((a, b) => {
    const ka = spouseSortKeyDesc(a[1]);
    const kb = spouseSortKeyDesc(b[1]);
    return kb.date - ka.date || kb.tie.localeCompare(ka.tie);
  });

  return [parent1Id, ranked[0][0]];
}

/** Current spouses: SPOUSE or ENGAGED only (DIVORCED excluded). */
export function getCurrentSpouseIds(
  personId: string,
  relationships: RelationshipRow[],
): string[] {
  return getCurrentSpouseIdsOrdered(personId, relationships);
}

/** Same as `getCurrentSpouseIds`, ordered oldest marriage first (`start_date`, then rel id). */
export function getCurrentSpouseIdsOrdered(
  personId: string,
  relationships: RelationshipRow[],
): string[] {
  const bySpouse = new Map<string, { date: number; tie: string }>();
  for (const r of relationships) {
    if (!CURRENT_SPOUSE_TYPES.has(r.relationship_type)) continue;
    if (r.person1_id !== personId && r.person2_id !== personId) continue;
    const other = r.person1_id === personId ? r.person2_id : r.person1_id;
    const key = spouseSortKey(r);
    const prev = bySpouse.get(other);
    if (!prev || key.date < prev.date || (key.date === prev.date && key.tie < prev.tie)) {
      bySpouse.set(other, key);
    }
  }
  return [...bySpouse.entries()]
    .sort((a, b) => a[1].date - b[1].date || a[1].tie.localeCompare(b[1].tie))
    .map(([id]) => id);
}
