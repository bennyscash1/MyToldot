import type { RelationshipType } from '@prisma/client';

import {
  hebrewFullName,
  type TreePersonSummary,
  type TreeRelationshipSummary,
} from '@/server/lib/family-discovery/summarize-tree';

import {
  MERGE_MAX_EXISTING_FAMILY,
  type ExistingFamilyMember,
} from './schema';

function formatBirthDate(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (m === 1 && day === 1) return String(y);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function pickPrimaryParent(
  personId: string,
  parentEdges: TreeRelationshipSummary[],
): string | null {
  const parents = parentEdges
    .filter((r) => r.person2_id === personId)
    .map((r) => r.person1_id);
  return parents[0] ?? null;
}

function pickSpouse(
  personId: string,
  spouseEdges: TreeRelationshipSummary[],
): string | null {
  for (const r of spouseEdges) {
    if (r.person1_id === personId) return r.person2_id;
    if (r.person2_id === personId) return r.person1_id;
  }
  return null;
}

function inferRole(
  personId: string,
  parentEdges: TreeRelationshipSummary[],
  lookup: Map<string, TreePersonSummary>,
): string | null {
  const hasParents = parentEdges.some((r) => r.person2_id === personId);
  const hasChildren = parentEdges.some((r) => r.person1_id === personId);
  const p = lookup.get(personId);
  if (!p) return null;
  if (!hasParents && hasChildren) return 'founder';
  if (hasParents && !hasChildren) return 'leaf';
  return null;
}

export interface BuildExistingFamilyResult {
  members: ExistingFamilyMember[];
  truncated: boolean;
}

export function buildExistingFamilySnapshot(
  persons: TreePersonSummary[],
  relationships: TreeRelationshipSummary[],
): BuildExistingFamilyResult {
  const parentTypes: RelationshipType[] = ['PARENT_CHILD', 'ADOPTED_PARENT'];
  const parentEdges = relationships.filter((r) =>
    parentTypes.includes(r.relationship_type),
  );
  const spouseEdges = relationships.filter(
    (r) => r.relationship_type === 'SPOUSE' || r.relationship_type === 'ENGAGED',
  );
  const lookup = new Map(persons.map((p) => [p.id, p]));

  const truncated = persons.length > MERGE_MAX_EXISTING_FAMILY;
  const slice = truncated ? persons.slice(0, MERGE_MAX_EXISTING_FAMILY) : persons;

  const members: ExistingFamilyMember[] = slice.map((p) => ({
    id: p.id,
    name: hebrewFullName(p),
    role: inferRole(p.id, parentEdges, lookup),
    parentId: pickPrimaryParent(p.id, parentEdges),
    spouseId: pickSpouse(p.id, spouseEdges),
    birthDate: formatBirthDate(p.birth_date),
  }));

  return { members, truncated };
}

export function existingFamilyNameMap(
  members: ExistingFamilyMember[],
): Map<string, string> {
  return new Map(members.map((m) => [m.id, m.name]));
}
