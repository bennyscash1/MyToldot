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
