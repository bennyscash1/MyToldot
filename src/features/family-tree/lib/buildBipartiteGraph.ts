import {
  PERSON_NODE_WIDTH,
  PERSON_NODE_HEIGHT,
  UNION_NODE_WIDTH,
  UNION_NODE_HEIGHT,
} from './constants';
import type {
  BipartiteEdge,
  BipartiteGraph,
  BipartiteNode,
  PersonRow,
  RelationshipRow,
  UnionMeta,
} from './types';

// ────────────────────────────────────────────────────────────────
// buildBipartiteGraph
//
// Pure transform: (persons, relationships, focalId) → bipartite graph.
//
// The critical trick is the synthetic Union node. A SPOUSE edge becomes a
// node, not an edge — so children later hang off the union's midpoint rather
// than off either parent individually. This is the geometry that makes the
// "line comes from between the parents" rendering fall out for free.
//
// Four passes:
//   1. Create a union node for every couple edge (SPOUSE / ENGAGED / DIVORCED).
//   2. For every child, resolve which union they hang from. If their two
//      parents already share a couple-union, reuse it. If not, synthesize a
//      "coparent" union so unmarried co-parents still render correctly. Solo
//      parents get a solo union.
//   3. Assign generations via BFS from the focal person.
//   4. Emit bipartite nodes + edges.
// ────────────────────────────────────────────────────────────────

const COUPLE_TYPES = new Set(['SPOUSE', 'ENGAGED', 'DIVORCED']);
const PARENT_TYPES = new Set(['PARENT_CHILD', 'ADOPTED_PARENT']);

/** Sort ids lexicographically so (A,B) and (B,A) produce the same key. */
function coupleKey(a: string, b: string): string {
  return a < b ? `c:${a}|${b}` : `c:${b}|${a}`;
}

export function buildBipartiteGraph(
  persons: PersonRow[],
  relationships: RelationshipRow[],
  focalId: string | null,
): BipartiteGraph {
  const personById = new Map(persons.map((p) => [p.id, p]));

  // ── Pass 1: collect couple unions keyed by sorted parent pair ───────────
  interface UnionRecord {
    id: string;
    parent_ids: [string] | [string, string];
    kind: 'couple' | 'solo' | 'coparent';
    spouse_relationship_id: string | null;
    is_divorced: boolean;
    is_engaged: boolean;
  }
  const unionsByKey = new Map<string, UnionRecord>();

  for (const r of relationships) {
    if (!COUPLE_TYPES.has(r.relationship_type)) continue;
    if (!personById.has(r.person1_id) || !personById.has(r.person2_id)) continue;
    const key = coupleKey(r.person1_id, r.person2_id);
    if (unionsByKey.has(key)) continue; // first couple row wins; later ones ignored
    const [a, b] = r.person1_id < r.person2_id
      ? [r.person1_id, r.person2_id]
      : [r.person2_id, r.person1_id];
    unionsByKey.set(key, {
      id: `u:${r.id}`,
      parent_ids: [a, b],
      kind: 'couple',
      spouse_relationship_id: r.id,
      is_divorced: r.relationship_type === 'DIVORCED',
      is_engaged: r.relationship_type === 'ENGAGED',
    });
  }

  // ── Pass 2: resolve each child's parent union ───────────────────────────
  // childId → list of parent person ids
  const parentsOfChild = new Map<string, string[]>();
  for (const r of relationships) {
    if (!PARENT_TYPES.has(r.relationship_type)) continue;
    if (!personById.has(r.person1_id) || !personById.has(r.person2_id)) continue;
    const list = parentsOfChild.get(r.person2_id) ?? [];
    if (!list.includes(r.person1_id)) list.push(r.person1_id);
    parentsOfChild.set(r.person2_id, list);
  }

  // childId → unionId their edge attaches to
  const childUnionOf = new Map<string, string>();
  // Track which unions we've kept (couple + synthesized). Keyed by union id.
  const keptUnions = new Map<string, UnionRecord>();

  for (const [childId, parents] of parentsOfChild) {
    if (parents.length === 0) continue;

    if (parents.length >= 2) {
      // Use the first two parents. Multi-parent trees (bio + adoptive) are
      // an edge case we'll extend later; MVP collapses to 2 for layout.
      const [p1, p2] = parents;
      const key = coupleKey(p1, p2);
      const existing = unionsByKey.get(key);
      if (existing) {
        childUnionOf.set(childId, existing.id);
        keptUnions.set(existing.id, existing);
      } else {
        const synthetic: UnionRecord = {
          id: `u:coparent:${[p1, p2].sort().join(':')}`,
          parent_ids: [p1 < p2 ? p1 : p2, p1 < p2 ? p2 : p1],
          kind: 'coparent',
          spouse_relationship_id: null,
          is_divorced: false,
          is_engaged: false,
        };
        unionsByKey.set(key, synthetic);
        keptUnions.set(synthetic.id, synthetic);
        childUnionOf.set(childId, synthetic.id);
      }
    } else {
      // Single recorded parent → solo union.
      const p = parents[0];
      const soloId = `u:solo:${p}`;
      if (!keptUnions.has(soloId)) {
        keptUnions.set(soloId, {
          id: soloId,
          parent_ids: [p],
          kind: 'solo',
          spouse_relationship_id: null,
          is_divorced: false,
          is_engaged: false,
        });
      }
      childUnionOf.set(childId, soloId);
    }
  }

  // We also keep every couple union even if it has no children (so spouses
  // still render connected). Merge them into keptUnions.
  for (const u of unionsByKey.values()) {
    if (u.kind === 'couple' && !keptUnions.has(u.id)) keptUnions.set(u.id, u);
  }

  // ── Pass 3: generation assignment (BFS from focal) ──────────────────────
  const gen = new Map<string, number>();

  // Build neighbor lookups.
  const spousesOf = new Map<string, string[]>();
  const siblingEdges = new Map<string, string[]>();
  for (const r of relationships) {
    if (COUPLE_TYPES.has(r.relationship_type)) {
      (spousesOf.get(r.person1_id) ?? spousesOf.set(r.person1_id, []).get(r.person1_id)!).push(r.person2_id);
      (spousesOf.get(r.person2_id) ?? spousesOf.set(r.person2_id, []).get(r.person2_id)!).push(r.person1_id);
    } else if (r.relationship_type === 'SIBLING') {
      (siblingEdges.get(r.person1_id) ?? siblingEdges.set(r.person1_id, []).get(r.person1_id)!).push(r.person2_id);
      (siblingEdges.get(r.person2_id) ?? siblingEdges.set(r.person2_id, []).get(r.person2_id)!).push(r.person1_id);
    }
  }
  const childrenOf = new Map<string, string[]>();
  for (const [childId, parents] of parentsOfChild) {
    for (const p of parents) {
      (childrenOf.get(p) ?? childrenOf.set(p, []).get(p)!).push(childId);
    }
  }

  if (focalId && personById.has(focalId)) {
    const queue: string[] = [focalId];
    gen.set(focalId, 0);
    while (queue.length) {
      const cur = queue.shift()!;
      const g = gen.get(cur)!;
      const push = (id: string, newG: number) => {
        if (gen.has(id)) return;
        gen.set(id, newG);
        queue.push(id);
      };
      (spousesOf.get(cur) ?? []).forEach((id) => push(id, g));
      (siblingEdges.get(cur) ?? []).forEach((id) => push(id, g));
      (parentsOfChild.get(cur) ?? []).forEach((id) => push(id, g - 1));
      (childrenOf.get(cur) ?? []).forEach((id) => push(id, g + 1));
    }
  }

  // Anyone unreachable from focal — fall back to gen 0 so they still render
  // (as a disconnected cluster).
  for (const p of persons) if (!gen.has(p.id)) gen.set(p.id, 0);

  // Union gen = its spouses' gen. If a union is "solo", match the parent.
  const unionGen = (u: UnionRecord): number => gen.get(u.parent_ids[0]) ?? 0;

  // ── Pass 4: emit bipartite nodes + edges ────────────────────────────────
  const nodes: BipartiteNode[] = [];
  const edges: BipartiteEdge[] = [];

  for (const p of persons) {
    nodes.push({
      id: p.id,
      kind: 'person',
      gen: gen.get(p.id)!,
      width: PERSON_NODE_WIDTH,
      height: PERSON_NODE_HEIGHT,
      person: p,
    });
  }

  for (const u of keptUnions.values()) {
    const meta: UnionMeta = {
      kind: u.kind,
      parent_ids: u.parent_ids,
      spouse_relationship_id: u.spouse_relationship_id,
      is_divorced: u.is_divorced,
      is_engaged: u.is_engaged,
    };
    nodes.push({
      id: u.id,
      kind: 'union',
      gen: unionGen(u),
      width: UNION_NODE_WIDTH,
      height: UNION_NODE_HEIGHT,
      union: meta,
    });

    // Spouse edges: each parent → union
    for (const pid of u.parent_ids) {
      edges.push({
        id: `e:sp:${u.id}:${pid}`,
        source: pid,
        target: u.id,
        kind: 'spouse',
        meta: { is_divorced: u.is_divorced, is_engaged: u.is_engaged },
      });
    }
  }

  // Child edges: union → child
  for (const [childId, unionId] of childUnionOf) {
    edges.push({
      id: `e:ch:${unionId}:${childId}`,
      source: unionId,
      target: childId,
      kind: 'child',
    });
  }

  // Build the convenience lookup maps the placeholder synthesizer needs.
  const person_unions = new Map<string, string[]>();
  for (const u of keptUnions.values()) {
    if (u.kind === 'solo') continue; // solo unions aren't "spouse unions"
    for (const pid of u.parent_ids) {
      (person_unions.get(pid) ?? person_unions.set(pid, []).get(pid)!).push(u.id);
    }
  }

  const parent_unions_of_person = new Map<string, string | null>();
  for (const p of persons) {
    parent_unions_of_person.set(p.id, childUnionOf.get(p.id) ?? null);
  }

  return { nodes, edges, person_unions, parent_unions_of_person };
}
