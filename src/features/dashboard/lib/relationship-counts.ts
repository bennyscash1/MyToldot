export interface RelationshipLike {
  relationship_type:
    | 'SPOUSE'
    | 'PARENT_CHILD'
    | 'SIBLING'
    | 'ENGAGED'
    | 'DIVORCED'
    | 'ADOPTED_PARENT';
  person1_id: string;
  person2_id: string;
}

export interface PersonRelations {
  spouseIds: string[];
  childIds: string[];
  parentIds: string[];
  siblingIds: string[];
  grandchildIds: string[];
  counts: {
    spouses: number;
    children: number;
    grandchildren: number;
  };
}

export function buildRelationsMap(
  relationships: RelationshipLike[],
): Map<string, PersonRelations> {
  const map = new Map<string, PersonRelations>();
  const ensure = (id: string): PersonRelations => {
    let r = map.get(id);
    if (!r) {
      r = {
        spouseIds: [],
        childIds: [],
        parentIds: [],
        siblingIds: [],
        grandchildIds: [],
        counts: { spouses: 0, children: 0, grandchildren: 0 },
      };
      map.set(id, r);
    }
    return r;
  };

  for (const rel of relationships) {
    const { relationship_type, person1_id, person2_id } = rel;
    if (relationship_type === 'PARENT_CHILD' || relationship_type === 'ADOPTED_PARENT') {
      ensure(person1_id).childIds.push(person2_id);
      ensure(person2_id).parentIds.push(person1_id);
    } else if (relationship_type === 'SPOUSE' || relationship_type === 'ENGAGED') {
      ensure(person1_id).spouseIds.push(person2_id);
      ensure(person2_id).spouseIds.push(person1_id);
    } else if (relationship_type === 'SIBLING') {
      ensure(person1_id).siblingIds.push(person2_id);
      ensure(person2_id).siblingIds.push(person1_id);
    }
  }

  for (const [, rel] of map) {
    const grandchildSet = new Set<string>();
    for (const childId of rel.childIds) {
      const childRel = map.get(childId);
      if (!childRel) continue;
      for (const gcId of childRel.childIds) grandchildSet.add(gcId);
    }
    rel.grandchildIds = Array.from(grandchildSet);
    rel.counts = {
      spouses: dedupe(rel.spouseIds).length,
      children: dedupe(rel.childIds).length,
      grandchildren: rel.grandchildIds.length,
    };
  }

  return map;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
