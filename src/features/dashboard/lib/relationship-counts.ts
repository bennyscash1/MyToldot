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
  divorcedSpouseIds: string[];
  childIds: string[];
  parentIds: string[];
  adoptiveParentIds: string[];
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
        divorcedSpouseIds: [],
        childIds: [],
        parentIds: [],
        adoptiveParentIds: [],
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
    if (relationship_type === 'PARENT_CHILD') {
      ensure(person1_id).childIds.push(person2_id);
      ensure(person2_id).parentIds.push(person1_id);
    } else if (relationship_type === 'ADOPTED_PARENT') {
      ensure(person1_id).childIds.push(person2_id);
      ensure(person2_id).parentIds.push(person1_id);
      ensure(person2_id).adoptiveParentIds.push(person1_id);
    } else if (relationship_type === 'SPOUSE' || relationship_type === 'ENGAGED') {
      ensure(person1_id).spouseIds.push(person2_id);
      ensure(person2_id).spouseIds.push(person1_id);
    } else if (relationship_type === 'DIVORCED') {
      ensure(person1_id).divorcedSpouseIds.push(person2_id);
      ensure(person2_id).divorcedSpouseIds.push(person1_id);
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

/** Max parent-child depth across the tree (generation span). */
export function computeGenerationCount(
  personIds: string[],
  relationsMap: Map<string, PersonRelations>,
): number {
  if (personIds.length === 0) return 0;

  const idSet = new Set(personIds);
  const roots = personIds.filter((id) => {
    const parents = relationsMap.get(id)?.parentIds ?? [];
    return parents.length === 0 || !parents.some((p) => idSet.has(p));
  });

  const startIds = roots.length > 0 ? roots : personIds;
  let maxDepth = 0;

  for (const rootId of startIds) {
    const depth = bfsDepth(rootId, relationsMap, idSet);
    if (depth > maxDepth) maxDepth = depth;
  }

  return Math.max(1, maxDepth);
}

function bfsDepth(
  rootId: string,
  relationsMap: Map<string, PersonRelations>,
  idSet: Set<string>,
): number {
  const queue: { id: string; depth: number }[] = [{ id: rootId, depth: 1 }];
  const visited = new Set<string>([rootId]);
  let maxDepth = 1;

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);
    const children = relationsMap.get(id)?.childIds ?? [];
    for (const childId of children) {
      if (!idSet.has(childId) || visited.has(childId)) continue;
      visited.add(childId);
      queue.push({ id: childId, depth: depth + 1 });
    }
  }

  return maxDepth;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
