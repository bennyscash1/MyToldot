import type { ElkNode } from 'elkjs';
import { GEN_HEIGHT, NODE_GAP } from './constants';
import type { BipartiteEdge, BipartiteGraph, BipartiteNode } from './types';
import type { ElkLayoutRequest, ElkLayoutResponse } from './elk.worker';

// ────────────────────────────────────────────────────────────────
// ELK layout, invoked via Web Worker.
//
// The worker is created lazily on first call and cached for the lifetime of
// the tab — spinning one up per layout would cost ~100ms on cold start and
// invalidate ELK's internal caches.
//
// We compute Y ourselves (gen * GEN_HEIGHT) so generation alignment is
// deterministic. ELK owns X — it runs network-simplex node placement plus
// barycenter-based crossing minimization, which gives near-optimal couple
// adjacency thanks to the bipartite structure: each spouse's only in-layer
// neighbor is their union, so the barycenters naturally place them side-by-
// side with the union between.
// ────────────────────────────────────────────────────────────────

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (r: ElkNode) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./elk.worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (event: MessageEvent<ElkLayoutResponse>) => {
    const { id } = event.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (event.data.ok) p.resolve(event.data.result);
    else p.reject(new Error(event.data.error));
  });
  return worker;
}

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
  // Convert to ELK's graph format.
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(GEN_HEIGHT),
      'elk.spacing.nodeNode': String(NODE_GAP),
      // Network-simplex gives tight, balanced placement vs BRANDES_KOEPF's
      // wider but more symmetric output. For dense family trees the tighter
      // layout scrolls less.
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      // Partitioning pins each generation to its own horizontal band. This
      // is the key constraint that keeps spouses on the same Y as each other
      // even when one has deeper ancestors than the other.
      'elk.partitioning.activate': 'true',
      // Honour input order when other criteria tie — keeps sibling order
      // stable across re-layouts.
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children: graph.nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      layoutOptions: {
        // Gen offset so all values are non-negative (ELK requires >= 0).
        'elk.partitioning.partition': String(n.gen + 1000),
      },
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const req: ElkLayoutRequest = { id: ++nextId, graph: elkGraph };
  const w = getWorker();
  const positioned = await new Promise<ElkNode>((resolve, reject) => {
    pending.set(req.id, { resolve, reject });
    w.postMessage(req);
  });

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const minGen = Math.min(...graph.nodes.map((n) => n.gen), 0);

  const nodes: PositionedNode[] = (positioned.children ?? []).map((c) => {
    const n = byId.get(c.id)!;
    // Override Y with our deterministic gen math. Shift so the top-most gen
    // is at y=0. ELK's x is kept; width/height unchanged.
    return {
      ...n,
      x: c.x ?? 0,
      y: (n.gen - minGen) * GEN_HEIGHT,
    };
  });

  const maxX = nodes.reduce((m, n) => Math.max(m, n.x + n.width), 0);
  const maxY = nodes.reduce((m, n) => Math.max(m, n.y + n.height), 0);

  return { nodes, edges: graph.edges, width: maxX, height: maxY };
}

/** Call from app teardown / HMR to release the worker. Optional. */
export function disposeElkWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
    pending.clear();
  }
}
