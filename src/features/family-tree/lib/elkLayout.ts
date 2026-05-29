import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs';
import {
  EDGE_NODE_GAP,
  ELK_LAYER_SPACING,
  GEN_HEIGHT,
  NODE_GAP,
  PERSON_SPOUSE_HANDLE_Y,
  UNION_NODE_HEIGHT,
} from './constants';
import { applyMultiSpouseLayoutPolicy } from './multiSpouseLayout';
import type { BipartiteEdge, BipartiteGraph, BipartiteNode } from './types';

// Both the person card and the union pill live in the same generation
// row, but the spouse-edge attachment point on the person card is at
// PERSON_SPOUSE_HANDLE_Y (avatar center). The union pill must vertically
// center on that same Y so spouse edges render perfectly horizontal.
const UNION_Y_OFFSET = PERSON_SPOUSE_HANDLE_Y - UNION_NODE_HEIGHT / 2; // = 60

// Partition offset: ELK partitions must be positive integers.
// We add 1000 so that negative generations (ancestors) still produce valid
// positive partition numbers. Spouses always share the same gen as their
// partner → same partition → ELK cannot separate them across layers.
const BASE_PARTITION = 1000;

// ────────────────────────────────────────────────────────────────
// ELK layout on the main thread.
//
// Architecture: Y is entirely ours, ELK owns X.
//
//   • Every node receives elk.partitioning.partition = gen + BASE_PARTITION.
//     This locks each node to its generation's layer regardless of edge
//     direction — spouses (same gen) share a partition and cannot drift.
//
//   • After ELK returns we DISCARD ELK's Y and recompute from gen.
//
//   • A final nuclear Y-pin pass iterates every spouse edge and forces
//     person.y = union.y - UNION_Y_OFFSET. This is an identity when gen
//     values are correct, but is an absolute hard guarantee: no ELK
//     configuration or stale gen value can ever place a spouse at a
//     different vertical row than their union.
// ────────────────────────────────────────────────────────────────

const elk = new ELK();

export interface PositionedNode extends BipartiteNode {
  x: number;
  y: number;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: BipartiteEdge[];
  width: number;
  height: number;
}

export async function layoutBipartiteGraph(
  graph: BipartiteGraph,
): Promise<LayoutResult> {
  const orderedNodes = orderNodesForElk(graph);

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      // Keep ELK layered distance moderate and use our own fixed generation
      // projection for final Y so rows remain stable and easy to scan.
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ELK_LAYER_SPACING),
      'elk.spacing.nodeNode': String(NODE_GAP),
      'elk.spacing.edgeNode': String(EDGE_NODE_GAP),
      // BRANDES_KOEPF with BALANCED alignment is the tidiest tree-ish node
      // placement available in ELK's layered framework — it centers parents
      // over their children when possible and produces straighter trunks.
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // Disable post-layout horizontal compaction so the spacing we (and our
      // post-layout subtree-collision pass) compute isn't shrunk away.
      'elk.layered.compaction.postCompaction.strategy': 'NONE',
      // Keep in-layer model ordering stable so spouse partners can stay adjacent.
      'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      // Force ELK to respect our generational partitioning. Without this,
      // same-generation spouse edges can cause ELK to collapse nodes into
      // the wrong layer when a parent-placeholder path runs through a spouse.
      'elk.partitioning.activate': 'true',
      'elk.layered.considerModelOrder.strategy': 'NODES',
    },
    children: orderedNodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      layoutOptions: {
        // Ancestors   (gen < 0) → partition < BASE_PARTITION
        // Focal gen   (gen = 0) → partition = BASE_PARTITION
        // Descendants (gen > 0) → partition > BASE_PARTITION
        // Spouses share gen with their partner → same partition number.
        'elk.partitioning.partition': String(n.gen + BASE_PARTITION),
      },
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const positioned = await elk.layout(elkGraph);

  const byId   = new Map(graph.nodes.map((n) => [n.id, n]));
  const minGen = Math.min(...graph.nodes.map((n) => n.gen), 0);

  // ── Pass 1: X from ELK, Y from gen (ELK's Y is discarded) ───────────────
  const nodeMap = new Map<string, PositionedNode>();
  for (const c of positioned.children ?? []) {
    const n = byId.get(c.id);
    if (!n) continue;
    const yBase = (n.gen - minGen) * GEN_HEIGHT;
    nodeMap.set(n.id, {
      ...n,
      x: c.x ?? 0,
      y: n.kind === 'union' ? yBase + UNION_Y_OFFSET : yBase,
    });
  }

  // Mark 3+ partner anchors: unions beyond the first two (by union id) render
  // children from the non-shared spouse only; pills stay in ELK but hide in UI.
  applyMultiSpouseLayoutPolicy(nodeMap, graph);

  // ── Pass 1.5: keep couple unions centered between spouses ────────────────
  // ELK can legally place same-generation union pills far away within the row,
  // which makes spouse lines span across unrelated siblings. Re-center each
  // 2-parent couple/corparent union between its two parents to keep spouse
  // connections local and visually correct.
  recenterCoupleUnions(nodeMap);

  // ── Pass 1.6: enforce couple adjacency within each generation ────────────
  // ELK's crossing minimization can break couple adjacency despite
  // forceNodeModelOrder=true: when a parent's union has multiple child
  // edges into the same row, ELK clusters the bloodline children together
  // and pushes spouses to the periphery. Pass 1.5 then centers the
  // couple-union pill between non-adjacent parents, and the straight
  // spouse line slices across whatever cards sit between them — which is
  // exactly what users see as "a horizontal line connecting siblings".
  //
  // This pass detects 2-parent unions whose parents aren't horizontally
  // adjacent and swaps the partner into a slot next to its anchor. Then
  // we re-run union re-centering so pill positions follow the new
  // person X grid.
  if (enforceCoupleAdjacency(nodeMap, graph.edges)) {
    recenterCoupleUnions(nodeMap);
  }

  // ── Pass 2: nuclear spouse Y-pin ─────────────────────────────────────────
  // For every spouse edge (person → union), hard-set person.y to match the
  // union's row. Mathematically redundant when gen values are correct, but
  // provides an absolute guarantee regardless of ELK internals or gen quirks.
  //
  // Invariant: person.y === union.y - UNION_Y_OFFSET
  for (const edge of graph.edges) {
    if (edge.kind !== 'spouse') continue;
    const union  = nodeMap.get(edge.target);
    const person = nodeMap.get(edge.source);
    if (!union || !person) continue;
    person.y = union.y - UNION_Y_OFFSET;
  }

  // ── Pass 3: center a lone child under its union pill ─────────────────────
  // ELK may place the only child under one parent's column; that forces a
  // stepped connector. Centering on the union keeps a straight vertical line.
  centerLoneChildrenUnderUnions(nodeMap, graph.edges);

  // ── Pass 4: subtree-collision repair ─────────────────────────────────────
  // ELK lays each generation out independently — it can pack siblings tight
  // even when one sibling's downstream subtree is much wider, causing those
  // descendants to crash into a neighbor's descendants below. Walk each
  // generation top-to-bottom; for each pair of adjacent person-bundles (a
  // person + spouses + their entire downward subtree) on the same row, if
  // their X extents overlap, shift the right bundle right by the deficit.
  repairSubtreeCollisions(nodeMap, graph.edges);

  // After shifting, re-center couple unions so the spouse-line pill follows
  // the new person X positions.
  recenterCoupleUnions(nodeMap);

  // Union X may have moved after Pass 3; keep each child under its union pill.
  centerLoneChildrenUnderUnions(nodeMap, graph.edges);

  const nodes: PositionedNode[] = Array.from(nodeMap.values());

  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.width), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.height), 0);

  return { nodes, edges: graph.edges, width: maxX, height: maxY };
}

/** No-op — kept for any future HMR cleanup. */
export function disposeElkWorker(): void {}

function centerLoneChildrenUnderUnions(
  nodeMap: Map<string, PositionedNode>,
  edges: BipartiteEdge[],
): void {
  const byUnion = new Map<string, BipartiteEdge[]>();
  for (const e of edges) {
    if (e.kind !== 'child') continue;
    const list = byUnion.get(e.source) ?? [];
    list.push(e);
    byUnion.set(e.source, list);
  }

  for (const [, childEdges] of byUnion) {
    if (childEdges.length !== 1) continue;
    const union = nodeMap.get(childEdges[0]!.source);
    if (!union || union.kind !== 'union') continue;

    const child = nodeMap.get(childEdges[0]!.target);
    if (!child || child.kind !== 'person') continue;

    // For solo unions the pill is hidden and the visible connector goes from
    // the parent's center bottom → child. Center the child under the parent
    // so pedigreeChildPath's straight-line branch fires (no horizontal jog).
    if (union.union?.kind === 'solo') {
      const parentId = union.union.parent_ids[0];
      const parent = parentId ? nodeMap.get(parentId) : undefined;
      if (!parent || parent.kind !== 'person') continue;
      const parentCenterX = parent.x + parent.width / 2;
      child.x = parentCenterX - child.width / 2;
      continue;
    }

    const soloParentId = union.union?.layout_solo_parent_id;
    if (soloParentId) {
      const parent = nodeMap.get(soloParentId);
      if (!parent || parent.kind !== 'person') continue;
      const parentCenterX = parent.x + parent.width / 2;
      child.x = parentCenterX - child.width / 2;
      continue;
    }

    const unionCenterX = union.x + union.width / 2;
    child.x = unionCenterX - child.width / 2;
  }
}

/**
 * Per-generation collision repair. For each generation top-to-bottom, build a
 * "down-bundle" for each person (the person + same-row spouses + all their
 * descendant persons and union pills), sort bundles by lead X, and shift the
 * right bundle right by any X-extent deficit against the left bundle. Only
 * positive shifts are ever applied — bundles whose extents don't overlap are
 * untouched, so this never spreads a layout that's already correct.
 */
function repairSubtreeCollisions(
  nodeMap: Map<string, PositionedNode>,
  edges: BipartiteEdge[],
): void {
  // Build helper maps.
  const unionsOfPerson = new Map<string, string[]>();
  const partnersInUnion = new Map<string, string[]>();
  const childrenOfUnion = new Map<string, string[]>();

  for (const n of nodeMap.values()) {
    if (n.kind !== 'union') continue;
    const pids = n.union?.parent_ids ?? [];
    partnersInUnion.set(n.id, [...pids]);
    for (const pid of pids) {
      const arr = unionsOfPerson.get(pid) ?? [];
      arr.push(n.id);
      unionsOfPerson.set(pid, arr);
    }
  }
  for (const e of edges) {
    if (e.kind !== 'child') continue;
    const arr = childrenOfUnion.get(e.source) ?? [];
    arr.push(e.target);
    childrenOfUnion.set(e.source, arr);
  }

  // Down-bundle: starting from `rootId`, collect self + same-row spouses
  // + their unions + all descendant persons and union pills (recursive).
  function downBundle(rootId: string): Set<string> {
    const bundle = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const pid = stack.pop()!;
      if (bundle.has(pid)) continue;
      bundle.add(pid);
      for (const uid of unionsOfPerson.get(pid) ?? []) {
        if (!bundle.has(uid)) bundle.add(uid);
        for (const partner of partnersInUnion.get(uid) ?? []) {
          if (partner !== pid && !bundle.has(partner)) stack.push(partner);
        }
        for (const childId of childrenOfUnion.get(uid) ?? []) {
          if (!bundle.has(childId)) stack.push(childId);
        }
      }
    }
    return bundle;
  }

  function extentOf(bundle: Set<string>): [number, number] {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    for (const id of bundle) {
      const n = nodeMap.get(id);
      if (!n) continue;
      if (n.x < minX) minX = n.x;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
    }
    return [minX, maxX];
  }

  const personsByGen = new Map<number, PositionedNode[]>();
  for (const n of nodeMap.values()) {
    if (n.kind !== 'person') continue;
    const arr = personsByGen.get(n.gen) ?? [];
    arr.push(n);
    personsByGen.set(n.gen, arr);
  }
  const gens = [...personsByGen.keys()].sort((a, b) => a - b);

  for (const gen of gens) {
    const row = (personsByGen.get(gen) ?? []).slice().sort((a, b) => a.x - b.x);
    const visited = new Set<string>();
    const clusters: Array<{ bundle: Set<string>; leadX: number }> = [];

    for (const p of row) {
      if (visited.has(p.id)) continue;
      const bundle = downBundle(p.id);
      for (const id of bundle) {
        const node = nodeMap.get(id);
        if (node && node.kind === 'person' && node.gen === gen) {
          visited.add(id);
        }
      }
      clusters.push({ bundle, leadX: p.x });
    }
    clusters.sort((a, b) => a.leadX - b.leadX);

    for (let i = 1; i < clusters.length; i += 1) {
      const [, leftMaxX] = extentOf(clusters[i - 1].bundle);
      const [rightMinX] = extentOf(clusters[i].bundle);
      if (!Number.isFinite(leftMaxX) || !Number.isFinite(rightMinX)) continue;
      const deficit = leftMaxX + NODE_GAP - rightMinX;
      if (deficit > 0) {
        for (const id of clusters[i].bundle) {
          const n = nodeMap.get(id);
          if (n) n.x += deficit;
        }
      }
    }
  }
}

function recenterCoupleUnions(nodeMap: Map<string, PositionedNode>): void {
  for (const node of nodeMap.values()) {
    if (node.kind !== 'union') continue;
    if (node.union?.layout_solo_parent_id) continue;
    const parentIds = node.union?.parent_ids;
    if (!parentIds || parentIds.length !== 2) continue;

    const p1 = nodeMap.get(parentIds[0]);
    const p2 = nodeMap.get(parentIds[1]);
    if (!p1 || !p2) continue;

    const p1CenterX = p1.x + p1.width / 2;
    const p2CenterX = p2.x + p2.width / 2;
    const midX = (p1CenterX + p2CenterX) / 2;
    node.x = midX - node.width / 2;
  }
}

/**
 * Detect 2-parent unions whose parents aren't horizontally adjacent in
 * their generation, and reorder persons in that gen so they are. Returns
 * true if anything moved (caller must re-run `recenterCoupleUnions`).
 *
 * Couple unions are processed in deterministic order: unions with more
 * child edges first (so the co-parent of existing children wins the
 * adjacent slot when a person has multiple spouses), then union id.
 * Secondary spouses may stay far. The smoothstep fallback in
 * useElkLayout.ts handles those leftover far-spouse edges so they route
 * around obstacles instead of through sibling cards.
 */
function childCountByUnion(edges: BipartiteEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of edges) {
    if (e.kind !== 'child') continue;
    counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  }
  return counts;
}

function enforceCoupleAdjacency(
  nodeMap: Map<string, PositionedNode>,
  edges: BipartiteEdge[],
): boolean {
  const childCounts = childCountByUnion(edges);
  const personsByGen = new Map<number, PositionedNode[]>();
  for (const node of nodeMap.values()) {
    if (node.kind !== 'person') continue;
    const list = personsByGen.get(node.gen) ?? [];
    list.push(node);
    personsByGen.set(node.gen, list);
  }
  for (const list of personsByGen.values()) {
    list.sort((a, b) => a.x - b.x);
  }

  // Snapshot the X grid per gen so we can re-assign positions in the new
  // order without inventing new X values (preserves ELK's overall span).
  const xGridByGen = new Map<number, number[]>();
  for (const [gen, list] of personsByGen) {
    xGridByGen.set(gen, list.map((p) => p.x));
  }

  const couples = Array.from(nodeMap.values())
    .filter((n) => n.kind === 'union' && n.union?.parent_ids?.length === 2)
    .sort((a, b) => {
      const childDiff = (childCounts.get(b.id) ?? 0) - (childCounts.get(a.id) ?? 0);
      if (childDiff !== 0) return childDiff;
      return a.id.localeCompare(b.id);
    });

  let changed = false;
  for (const u of couples) {
    // Only force adjacency for unions that anchor existing children. Childless
    // spouse pairs (e.g. a second marriage added later) keep ELK positions so
    // they cannot displace the first spouse away from the focal parent.
    if ((childCounts.get(u.id) ?? 0) === 0) continue;
    // 3+ partner anchors: only the first two couple unions (by id) use pills.
    if (u.union?.layout_solo_parent_id) continue;

    const ids = u.union?.parent_ids;
    if (!ids || ids.length !== 2) continue;
    const a = nodeMap.get(ids[0]);
    const b = nodeMap.get(ids[1]);
    if (!a || !b || a.gen !== b.gen) continue;

    const list = personsByGen.get(a.gen);
    if (!list) continue;

    const aIdx = list.indexOf(a);
    const bIdx = list.indexOf(b);
    if (aIdx === -1 || bIdx === -1) continue;
    if (Math.abs(aIdx - bIdx) <= 1) continue;

    // Move b adjacent to a, preserving which side (left/right) b was on.
    const bWasRightOfA = bIdx > aIdx;
    list.splice(bIdx, 1);
    const newAIdx = list.indexOf(a);
    list.splice(bWasRightOfA ? newAIdx + 1 : newAIdx, 0, b);
    changed = true;
  }

  if (!changed) return false;

  for (const [gen, list] of personsByGen) {
    const xs = xGridByGen.get(gen);
    if (!xs) continue;
    for (let i = 0; i < list.length; i += 1) {
      list[i].x = xs[i];
    }
  }

  return true;
}

function orderNodesForElk(graph: BipartiteGraph): BipartiteNode[] {
  // Multi-partner support: a person with two spouses has two couple unions,
  // and we want both partners listed near the anchor in model order. We
  // can't satisfy all-adjacent in 1D, so the deterministic rule is: the
  // partner with the lowest id sits in the immediately-adjacent slot;
  // secondary partners follow after in id-ascending order.
  const partnersOf = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.kind !== 'union') continue;
    const parentIds = node.union?.parent_ids;
    if (!parentIds || parentIds.length !== 2) continue;
    const [a, b] = parentIds;
    (partnersOf.get(a) ?? partnersOf.set(a, []).get(a)!).push(b);
    (partnersOf.get(b) ?? partnersOf.set(b, []).get(b)!).push(a);
  }

  const byGen = new Map<number, BipartiteNode[]>();
  for (const n of graph.nodes) {
    const list = byGen.get(n.gen) ?? [];
    list.push(n);
    byGen.set(n.gen, list);
  }

  const gens = [...byGen.keys()].sort((a, b) => a - b);
  const ordered: BipartiteNode[] = [];

  for (const gen of gens) {
    const layer = byGen.get(gen) ?? [];
    const persons = layer.filter((n) => n.kind === 'person');
    const unions = layer.filter((n) => n.kind === 'union');

    const personById = new Map(persons.map((p) => [p.id, p]));
    const used = new Set<string>();
    const orderedPersons: BipartiteNode[] = [];

    for (const p of persons) {
      if (used.has(p.id)) continue;
      orderedPersons.push(p);
      used.add(p.id);

      const partnerIds = (partnersOf.get(p.id) ?? []).slice().sort();
      for (const partnerId of partnerIds) {
        if (used.has(partnerId)) continue;
        const partner = personById.get(partnerId);
        if (!partner) continue;
        orderedPersons.push(partner);
        used.add(partnerId);
      }
    }

    ordered.push(...orderedPersons, ...unions);
  }

  return ordered;
}
