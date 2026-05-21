import type { RelationshipRow } from './types';

const CURRENT_SPOUSE_TYPES = new Set(['SPOUSE', 'ENGAGED']);

/** Current spouses: SPOUSE or ENGAGED only (DIVORCED excluded). */
export function getCurrentSpouseIds(
  personId: string,
  relationships: RelationshipRow[],
): string[] {
  const seen = new Set<string>();
  for (const r of relationships) {
    if (!CURRENT_SPOUSE_TYPES.has(r.relationship_type)) continue;
    if (r.person1_id !== personId && r.person2_id !== personId) continue;
    const other = r.person1_id === personId ? r.person2_id : r.person1_id;
    seen.add(other);
  }
  return [...seen];
}
