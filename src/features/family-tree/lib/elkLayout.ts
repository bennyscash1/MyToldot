import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs';
import { GEN_HEIGHT, NODE_GAP, PERSON_NODE_HEIGHT, UNION_NODE_HEIGHT } from './constants';
import type { BipartiteEdge, BipartiteGraph, BipartiteNode } from './types';

// Union nodes are tiny pills (UNION_NODE_HEIGHT = 12px) while person cards are
// tall (PERSON_NODE_HEIGHT = 212px). Both live in the same generation row, so we
// offset the union node downward so its vertical midpoint aligns with the
// person card midpoint. This makes spouse edges perfectly horizontal.
const UNION_Y_OFFSET = (PERSON_NODE_HEIGHT - UNION_NODE_HEIGHT) / 2; // = 100

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
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(GEN_HEIGHT),
      'elk.spacing.nodeNode': String(NODE_GAP),
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // Force ELK to respect our generational partitioning. Without this,
      // same-generation spouse edges can cause ELK to collapse nodes into
      // the wrong layer when a parent-placeholder path runs through a spouse.
      'elk.partitioning.activate': 'true',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: graph.nodes.map((n) => ({
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

  const nodes: PositionedNode[] = Array.from(nodeMap.values());

  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.width), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.height), 0);

  return { nodes, edges: graph.edges, width: maxX, height: maxY };
}

/** No-op — kept for any future HMR cleanup. */
export function disposeElkWorker(): void {}
