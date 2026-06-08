import type { BipartiteGraph, PersonRow } from '@/features/family-tree/lib/types';

import { personDisplayName } from './summarize';

function genderWord(
  g: PersonRow['gender'],
  kind: 'child' | 'spouse' | 'parent' | 'sibling',
): string {
  if (kind === 'spouse') {
    if (g === 'FEMALE') return 'בת זוג';
    if (g === 'MALE') return 'בן זוג';
    return 'בן/בת זוג';
  }
  if (kind === 'parent') {
    if (g === 'FEMALE') return 'אם';
    if (g === 'MALE') return 'אב';
    return 'הורה';
  }
  if (kind === 'sibling') {
    if (g === 'FEMALE') return 'אחות';
    if (g === 'MALE') return 'אח';
    return 'אח/אחות';
  }
  if (g === 'FEMALE') return 'בת';
  if (g === 'MALE') return 'בן';
  return 'ילד/ה';
}

function buildRelationshipMaps(graph: BipartiteGraph) {
  const spouses = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();

  for (const e of graph.edges) {
    if (e.kind === 'spouse') {
      const unionId = e.target;
      for (const e2 of graph.edges) {
        if (e2.kind === 'spouse' && e2.target === unionId && e2.source !== e.source) {
          const a = e.source;
          const b = e2.source;
          (spouses.get(a) ?? spouses.set(a, []).get(a)!).push(b);
          (spouses.get(b) ?? spouses.set(b, []).get(b)!).push(a);
        }
      }
    }
    if (e.kind === 'child') {
      const union = graph.nodes.find((n) => n.id === e.source && n.kind === 'union');
      if (!union?.union) continue;
      for (const pid of union.union.parent_ids) {
        (childrenOf.get(pid) ?? childrenOf.set(pid, []).get(pid)!).push(e.target);
        (parentsOf.get(e.target) ?? parentsOf.set(e.target, []).get(e.target)!).push(pid);
      }
    }
  }

  return { spouses, childrenOf, parentsOf };
}

/**
 * Hebrew relationship caption for the biography section, derived from graph
 * topology (parent, child, spouse) — not guessed by AI.
 */
export function relationshipLabelHe(
  graph: BipartiteGraph,
  personId: string,
  headId: string,
  personById: Map<string, PersonRow>,
): string {
  const person = personById.get(personId);
  if (!person) return '';
  if (personId === headId) return 'ראש המשפחה';

  const { spouses, childrenOf, parentsOf } = buildRelationshipMaps(graph);

  if (childrenOf.get(personId)?.includes(headId)) {
    return genderWord(person.gender, 'parent');
  }

  const headParents = parentsOf.get(headId) ?? [];
  const personParents = parentsOf.get(personId) ?? [];
  if (
    personId !== headId &&
    headParents.length > 0 &&
    headParents.every((p) => personParents.includes(p))
  ) {
    return genderWord(person.gender, 'sibling');
  }

  if (spouses.get(headId)?.includes(personId)) {
    return genderWord(person.gender, 'spouse');
  }

  if (childrenOf.get(headId)?.includes(personId)) {
    return genderWord(person.gender, 'child');
  }

  for (const [parentId, kids] of childrenOf) {
    if (kids.includes(personId) && spouses.get(parentId)?.includes(headId)) {
      return genderWord(person.gender, 'child');
    }
  }

  for (const spouseId of spouses.get(personId) ?? []) {
    const spouse = personById.get(spouseId);
    if (!spouse) continue;
    const headKids = childrenOf.get(headId) ?? [];
    if (headKids.includes(spouseId)) {
      return `${genderWord(person.gender, 'spouse')} של ${personDisplayName(spouse)}`;
    }
    if (spouseId === headId) return genderWord(person.gender, 'spouse');
  }

  if ((parentsOf.get(personId) ?? []).some((p) => childrenOf.get(headId)?.includes(p))) {
    return 'נכד/ה';
  }

  return 'בן משפחה';
}

/** Verified relationship lines for AI copy — derived from graph topology. */
export function buildFamilyRelationshipLines(
  graph: BipartiteGraph,
  headId: string,
  personById: Map<string, PersonRow>,
): string[] {
  const personNodes = graph.nodes.filter((n) => n.kind === 'person');
  return personNodes
    .map((n) => {
      const person = personById.get(n.id);
      if (!person) return null;
      const rel = relationshipLabelHe(graph, n.id, headId, personById);
      const gender =
        person.gender === 'MALE' ? 'זכר' : person.gender === 'FEMALE' ? 'נקבה' : '';
      const suffix = gender ? ` (${gender})` : '';
      return `${personDisplayName(person)} — ${rel}${suffix}`;
    })
    .filter((line): line is string => line != null)
    .sort((a, b) => a.localeCompare(b, 'he'));
}
