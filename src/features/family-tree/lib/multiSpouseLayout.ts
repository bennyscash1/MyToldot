import type { BipartiteGraph, BipartiteNode } from './types';
import type { PositionedNode } from './elkLayout';

/** Minimum distinct partners on couple unions before overflow solo-child layout applies. */
export const MULTI_SPOUSE_PARTNER_THRESHOLD = 3;

/** How many couple-union pills to keep per multi-spouse anchor (rest use solo-parent children). */
export const MULTI_SPOUSE_PILL_SLOTS = 2;

export interface CoupleUnionRef {
  unionId: string;
  partnerId: string;
}

/**
 * Collects distinct partners per person from 2-parent `couple` union nodes
 * (already derived from SPOUSE / ENGAGED / DIVORCED in buildBipartiteGraph).
 */
export function couplePartnersByPerson(graph: BipartiteGraph): Map<string, Set<string>> {
  const partners = new Map<string, Set<string>>();

  for (const n of graph.nodes) {
    if (n.kind !== 'union' || n.union?.kind !== 'couple') continue;
    const pids = n.union.parent_ids;
    if (!pids || pids.length !== 2) continue;
    const [a, b] = pids;
    for (const personId of [a, b]) {
      const other = personId === a ? b : a;
      const set = partners.get(personId) ?? new Set<string>();
      set.add(other);
      partners.set(personId, set);
    }
  }

  return partners;
}

export function coupleUnionsForPerson(graph: BipartiteGraph, personId: string): CoupleUnionRef[] {
  const refs: CoupleUnionRef[] = [];
  for (const n of graph.nodes) {
    if (n.kind !== 'union' || n.union?.kind !== 'couple') continue;
    const pids = n.union.parent_ids;
    if (!pids || pids.length !== 2) continue;
    if (pids[0] === personId) refs.push({ unionId: n.id, partnerId: pids[1] });
    else if (pids[1] === personId) refs.push({ unionId: n.id, partnerId: pids[0] });
  }
  return refs.sort((a, b) => a.unionId.localeCompare(b.unionId));
}

/**
 * For each person with 3+ couple partners, mark union nodes at index 2+ with
 * `layout_solo_parent_id` (the non-shared spouse). First two unions by union
 * id keep normal pill rendering.
 */
export function applyMultiSpouseLayoutPolicy(
  nodeMap: Map<string, PositionedNode>,
  graph: BipartiteGraph,
): void {
  const partnersByPerson = couplePartnersByPerson(graph);

  for (const [personId, partnerSet] of partnersByPerson) {
    if (partnerSet.size < MULTI_SPOUSE_PARTNER_THRESHOLD) continue;

    const unions = coupleUnionsForPerson(graph, personId);
    for (let i = MULTI_SPOUSE_PILL_SLOTS; i < unions.length; i += 1) {
      const { unionId, partnerId } = unions[i]!;
      const node = nodeMap.get(unionId);
      if (!node || node.kind !== 'union' || !node.union) continue;
      node.union = { ...node.union, layout_solo_parent_id: partnerId };
    }
  }
}

export function isLayoutSoloChildUnion(node: BipartiteNode | PositionedNode | undefined): boolean {
  return Boolean(node?.kind === 'union' && node.union?.layout_solo_parent_id);
}
