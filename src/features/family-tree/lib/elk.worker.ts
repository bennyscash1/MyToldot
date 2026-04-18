/// <reference lib="webworker" />

// ELK Web Worker.
//
// Next 15 (Turbopack + webpack) bundles this automatically when the main
// thread does `new Worker(new URL('./elk.worker.ts', import.meta.url))`.
// Keep this file dependency-light — anything imported here bloats the worker
// bundle, which is loaded on every tree view.

import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs';

const elk = new ELK();

export interface ElkLayoutRequest {
  id: number;
  graph: ElkNode;
}

export type ElkLayoutResponse =
  | { id: number; ok: true; result: ElkNode }
  | { id: number; ok: false; error: string };

self.addEventListener('message', async (event: MessageEvent<ElkLayoutRequest>) => {
  const { id, graph } = event.data;
  try {
    const result = await elk.layout(graph);
    const response: ElkLayoutResponse = { id, ok: true, result };
    (self as unknown as Worker).postMessage(response);
  } catch (err) {
    const response: ElkLayoutResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(response);
  }
});

// Marker export so TS treats this as a module (otherwise `self` typings
// may leak into global scope).
export {};
