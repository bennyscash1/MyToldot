import type { MergeNewPerson } from './schema';

function anchorIdForPerson(p: MergeNewPerson): string | null {
  switch (p.relation) {
    case 'child':
      return p.parentId ?? null;
    case 'parent':
      return p.childOf ?? null;
    case 'spouse':
      return p.spouseId ?? null;
    case 'sibling':
      return p.siblingOf ?? null;
    default:
      return null;
  }
}

/** Topological order: parents (anchors) before dependents. */
export function topologicalSortNewPeople(people: MergeNewPerson[]): MergeNewPerson[] {
  const byId = new Map(people.map((p) => [p.tempId, p]));
  const tempIds = new Set(people.map((p) => p.tempId));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const p of people) {
    inDegree.set(p.tempId, 0);
  }

  for (const p of people) {
    const anchor = anchorIdForPerson(p);
    if (anchor && tempIds.has(anchor)) {
      inDegree.set(p.tempId, (inDegree.get(p.tempId) ?? 0) + 1);
      const list = dependents.get(anchor) ?? [];
      list.push(p.tempId);
      dependents.set(anchor, list);
    }
  }

  const queue = people.filter((p) => (inDegree.get(p.tempId) ?? 0) === 0).map((p) => p.tempId);
  const ordered: MergeNewPerson[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const person = byId.get(id);
    if (person) ordered.push(person);
    for (const dep of dependents.get(id) ?? []) {
      const next = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, next);
      if (next === 0) queue.push(dep);
    }
  }

  if (ordered.length < people.length) {
    const remaining = people.filter((p) => !ordered.includes(p));
    return [...ordered, ...remaining];
  }
  return ordered;
}
