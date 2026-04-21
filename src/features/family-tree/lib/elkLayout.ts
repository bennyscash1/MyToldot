import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs';
import { GEN_HEIGHT, NODE_GAP, PERSON_NODE_HEIGHT, UNION_NODE_HEIGHT } from './constants';
import type { BipartiteEdge, BipartiteGraph, BipartiteNode } from './types';

// Union nodes are tiny pills (UNION_NODE_HEIGHT = 12px) while person cards are
// tall (PERSON_NODE_HEIGHT = 212px). Both live in the same generation row, so we
// offset the union node downward so its vertical midpoint aligns with the
// person card midpoint. This makes spouse edges perfectly horizontal.
const UNION_Y_OFFSET = (PERSON_NODE_HEIGHT - UNION_NODE_HEIGHT) / 2; // = 100

// ────────────────────────────────────────────────────────────────
// ELK layout on the main thread.
//
// We previously ran ELK in a Web Worker, but Next.js + Turbopack often fails
// to deliver worker responses, leaving layout promises pending forever and
// the UI stuck on “מסדר את העץ…”. Family graphs here are small enough that
// main-thread layout is fine.
//
// We compute Y ourselves (gen * GEN_HEIGHT) so generation alignment is
// deterministic. ELK owns X.
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
      'elk.partitioning.activate': 'true',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: graph.nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      layoutOptions: {
        'elk.partitioning.partition': String(n.gen + 1000),
      },
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const positioned = await elk.layout(elkGraph);

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const minGen = Math.min(...graph.nodes.map((n) => n.gen), 0);

  const nodes: PositionedNode[] = (positioned.children ?? []).map((c) => {
    const n = byId.get(c.id)!;
    // Union nodes get a vertical offset so their midpoint aligns with
    // the midpoint of person cards in the same generation row.
    const yBase = (n.gen - minGen) * GEN_HEIGHT;
    return {
      ...n,
      x: c.x ?? 0,
      y: n.kind === 'union' ? yBase + UNION_Y_OFFSET : yBase,
    };
  });

  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.width), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.height), 0);

  return { nodes, edges: graph.edges, width: maxX, height: maxY };
}

/** No-op — kept for any future HMR cleanup. */
export function disposeElkWorker(): void {}
