import type { AiPerson, AiRelationship, AiTreePlan } from './schema';

const UNKNOWN_HE = 'לא ידוע';

/**
 * Post-process a model-emitted plan so it satisfies invariants the downstream
 * Prisma layer will rely on. The model is asked (in the system prompt) to
 * follow these rules, but it occasionally slips — we enforce them here so a
 * single bad response never produces a corrupt tree.
 *
 * Operations, in order:
 *  1. Drop persons missing a `local_id`.
 *  2. Normalize blank name fields to "לא ידוע" — never let an empty string
 *     reach the DB's `first_name` (required) column.
 *  3. Drop relationships whose endpoints don't exist among the persons.
 *  4. Deduplicate symmetric pairs (SPOUSE, SIBLING) — keep first occurrence,
 *     drop later flips.
 *  5. Drop redundant SIBLING edges between two persons who already share a
 *     PARENT_CHILD edge from the same parent (Section 5.2 of the prompt).
 *  6. Add missing PARENT_CHILD from spouse when a child has only one parent
 *     but the plan includes a SPOUSE edge for that parent.
 *  7. Resolve `suggested_root_local_id` to a still-existing person; if the
 *     pointer is dangling, pick the most-connected person as a fallback.
 *
 * Does NOT throw on duplicate persons, missing optional fields, etc. — the
 * Zod parse upstream is the schema gate; this is purely a post-validate
 * cleanup.
 */
export function reconcileAiTreePlan(plan: AiTreePlan): AiTreePlan {
  const persons = plan.persons
    .filter((p) => p.local_id && p.local_id.length > 0)
    .map(normalizePersonNames);

  const validIds = new Set(persons.map((p) => p.local_id));

  const referenceValid = plan.relationships.filter(
    (r) => validIds.has(r.from_local_id) && validIds.has(r.to_local_id) && r.from_local_id !== r.to_local_id,
  );

  const dedupedSymmetric = dedupeSymmetric(referenceValid);
  const withoutRedundantSiblings = dropRedundantSiblings(dedupedSymmetric);
  const withCoupleParentEdges = enrichCoupleParentChildEdges(withoutRedundantSiblings);

  const suggestedRoot = validIds.has(plan.suggested_root_local_id)
    ? plan.suggested_root_local_id
    : pickFallbackRoot(persons, withCoupleParentEdges);

  return {
    summary: plan.summary ?? '',
    persons,
    relationships: withCoupleParentEdges,
    suggested_root_local_id: suggestedRoot,
  };
}

function normalizePersonNames(p: AiPerson): AiPerson {
  const first_name_he = p.first_name_he && p.first_name_he.trim().length > 0 ? p.first_name_he : UNKNOWN_HE;
  const last_name_he = p.last_name_he && p.last_name_he.trim().length > 0 ? p.last_name_he : UNKNOWN_HE;
  return { ...p, first_name_he, last_name_he };
}

function dedupeSymmetric(rels: AiRelationship[]): AiRelationship[] {
  const seen = new Set<string>();
  const out: AiRelationship[] = [];
  for (const r of rels) {
    const key = symmetricKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function symmetricKey(r: AiRelationship): string {
  if (r.type === 'PARENT_CHILD') {
    return `PARENT_CHILD|${r.from_local_id}|${r.to_local_id}`;
  }
  const [a, b] = r.from_local_id < r.to_local_id
    ? [r.from_local_id, r.to_local_id]
    : [r.to_local_id, r.from_local_id];
  return `${r.type}|${a}|${b}`;
}

function dropRedundantSiblings(rels: AiRelationship[]): AiRelationship[] {
  const parentsOf = new Map<string, Set<string>>();
  for (const r of rels) {
    if (r.type !== 'PARENT_CHILD') continue;
    const set = parentsOf.get(r.to_local_id) ?? new Set<string>();
    set.add(r.from_local_id);
    parentsOf.set(r.to_local_id, set);
  }

  return rels.filter((r) => {
    if (r.type !== 'SIBLING') return true;
    const aParents = parentsOf.get(r.from_local_id);
    const bParents = parentsOf.get(r.to_local_id);
    if (!aParents || !bParents) return true;
    for (const p of aParents) if (bParents.has(p)) return false;
    return true;
  });
}

/** When a child has one PARENT_CHILD parent who has a SPOUSE in the plan, add the spouse edge. */
function enrichCoupleParentChildEdges(rels: AiRelationship[]): AiRelationship[] {
  const spouseOf = new Map<string, string>();
  for (const r of rels) {
    if (r.type !== 'SPOUSE') continue;
    spouseOf.set(r.from_local_id, r.to_local_id);
    spouseOf.set(r.to_local_id, r.from_local_id);
  }

  const parentsByChild = new Map<string, Set<string>>();
  for (const r of rels) {
    if (r.type !== 'PARENT_CHILD') continue;
    const set = parentsByChild.get(r.to_local_id) ?? new Set<string>();
    set.add(r.from_local_id);
    parentsByChild.set(r.to_local_id, set);
  }

  const existingKeys = new Set(rels.filter((r) => r.type === 'PARENT_CHILD').map(parentChildKey));
  const additions: AiRelationship[] = [];

  for (const [childId, parents] of parentsByChild) {
    if (parents.size !== 1) continue;
    const parentP = [...parents][0];
    const spouseQ = spouseOf.get(parentP);
    if (!spouseQ || parents.has(spouseQ)) continue;

    const key = parentChildKey({
      type: 'PARENT_CHILD',
      from_local_id: spouseQ,
      to_local_id: childId,
    });
    if (existingKeys.has(key)) continue;

    additions.push({
      type: 'PARENT_CHILD',
      from_local_id: spouseQ,
      to_local_id: childId,
    });
    existingKeys.add(key);
  }

  return additions.length > 0 ? [...rels, ...additions] : rels;
}

function parentChildKey(r: Pick<AiRelationship, 'type' | 'from_local_id' | 'to_local_id'>): string {
  return `PARENT_CHILD|${r.from_local_id}|${r.to_local_id}`;
}

function pickFallbackRoot(persons: AiPerson[], rels: AiRelationship[]): string {
  if (persons.length === 0) return '';

  const childIds = new Set<string>();
  for (const r of rels) {
    if (r.type === 'PARENT_CHILD') childIds.add(r.to_local_id);
  }
  const orphans = persons.filter((p) => !childIds.has(p.local_id));

  const degree = new Map<string, number>();
  for (const r of rels) {
    degree.set(r.from_local_id, (degree.get(r.from_local_id) ?? 0) + 1);
    degree.set(r.to_local_id, (degree.get(r.to_local_id) ?? 0) + 1);
  }

  const pool = orphans.length > 0 ? orphans : persons;
  let best = pool[0];
  let bestScore = -1;
  for (const p of pool) {
    const score = degree.get(p.local_id) ?? 0;
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best.local_id;
}
