'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { buildBipartiteGraph } from '../lib/buildBipartiteGraph';
import { synthesizePlaceholders } from '../lib/placeholders';
import { layoutBipartiteGraph, type LayoutResult } from '../lib/elkLayout';
import type { FlowEdge, FlowNode, PersonRow, RelationshipRow } from '../lib/types';

interface UseElkLayoutArgs {
  persons: PersonRow[];
  relationships: RelationshipRow[];
  focalId: string | null;
  /** When false, skip placeholder synthesis (useful for read-only / public view). */
  showPlaceholders?: boolean;
}

interface UseElkLayoutResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Turns raw tree data into positioned React Flow nodes/edges via ELK.
 *
 * Memoization strategy:
 *  - topoHash covers persons, relationships, and the placeholder flag.
 *    It intentionally excludes focalId — changing the focal must not
 *    trigger a re-layout (that causes spouse nodes to drift off their row).
 *  - focalId is tracked via a separate ref so that the one-time
 *    null→real-id initialisation transition still triggers a layout run.
 *  - While an async ELK run is in-flight the previous output is kept so
 *    the canvas does not flash.
 */
export function useElkLayout({
  persons,
  relationships,
  focalId,
  showPlaceholders = true,
}: UseElkLayoutArgs): UseElkLayoutResult {
  // focalId is excluded from the hash — see jsdoc above.
  const topoHash = useMemo(() => {
    if (persons.length === 0) return '__empty__';
    return hashTopology(persons, relationships, showPlaceholders);
  }, [persons, relationships, showPlaceholders]);

  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const lastHash    = useRef<string | null>(null);
  const lastFocalId = useRef<string | null | undefined>(undefined); // undefined = never seen

  useEffect(() => {
    // No people → clear state, no ELK.
    if (persons.length === 0) {
      lastHash.current    = '__empty__';
      lastFocalId.current = focalId;
      setLayout(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const topoUnchanged  = topoHash === lastHash.current;
    const focalUnchanged = focalId  === lastFocalId.current;

    // Skip if nothing that affects layout has changed.
    if (topoUnchanged && focalUnchanged) return;

    let cancelled = false;
    setIsLoading(true);

    const graph = buildBipartiteGraph(persons, relationships, focalId);
    if (showPlaceholders) {
      const ph = synthesizePlaceholders(graph, focalId);
      graph.nodes.push(...ph.nodes);
      graph.edges.push(...ph.edges);
    }

    layoutBipartiteGraph(graph)
      .then((result) => {
        if (cancelled) return;
        setLayout(result);
        setError(null);
        lastHash.current    = topoHash;
        lastFocalId.current = focalId;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };

  // focalId dep: fires on the one-time null→real-id init; frozen thereafter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topoHash, focalId, persons.length]);

  const { nodes, edges } = useMemo(
    () => toFlowElements(layout, focalId),
    [layout, focalId],
  );

  return { nodes, edges, isLoading, error };
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function hashTopology(
  persons: PersonRow[],
  relationships: RelationshipRow[],
  showPlaceholders: boolean,
): string {
  // focalId intentionally excluded — see hook jsdoc.
  // Only topology-relevant fields; cosmetic edits (name, birth date) are ignored.
  const p = persons
    .map((x) => x.id)
    .sort()
    .join(',');
  const r = relationships
    .map((x) => `${x.id}:${x.relationship_type}:${x.person1_id}>${x.person2_id}`)
    .sort()
    .join('|');
  return `${showPlaceholders ? 1 : 0}|${p}|${r}`;
}

function toFlowElements(
  layout: LayoutResult | null,
  focalId: string | null,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (!layout) return { nodes: [], edges: [] };

  const nodes: FlowNode[] = layout.nodes.map((n) => {
    if (n.kind === 'person') {
      return {
        id: n.id,
        type: 'person',
        position: { x: n.x, y: n.y },
        data: { person: n.person!, is_focal: n.id === focalId },
        draggable: false,
      } as FlowNode;
    }
    if (n.kind === 'union') {
      return {
        id: n.id,
        type: 'union',
        position: { x: n.x, y: n.y },
        data: { meta: n.union! },
        draggable: false,
        selectable: false,
      } as FlowNode;
    }
    return {
      id: n.id,
      type: 'placeholder',
      position: { x: n.x, y: n.y },
      data: { meta: n.placeholder! },
      draggable: false,
    } as FlowNode;
  });

  const posById = new Map(layout.nodes.map((n) => [n.id, n]));

  const edges: FlowEdge[] = layout.edges.map((e) => {
    if (e.kind === 'spouse') {
      // Straight horizontal line. Route from the person's facing handle to
      // the union's matching handle based on relative X position.
      const person = posById.get(e.source);
      const union  = posById.get(e.target);
      let sourceHandle: string | undefined;
      let targetHandle: string | undefined;
      if (person && union) {
        const personCenterX = person.x + person.width / 2;
        const unionCenterX  = union.x  + union.width  / 2;
        if (personCenterX <= unionCenterX) {
          sourceHandle = 'right';
          targetHandle = 'spouse-left';
        } else {
          sourceHandle = 'left';
          targetHandle = 'spouse-right';
        }
      }
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'straight',
        sourceHandle,
        targetHandle,
        className: e.meta?.is_divorced
          ? 'shortree-edge-divorced'
          : 'shortree-edge-spouse',
      } as FlowEdge;
    }

    // Child / descent edge — orthogonal step path.
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'step',
      sourceHandle: 'children',
      targetHandle: 'top',
      className: 'shortree-edge-child',
    } as FlowEdge;
  });

  return { nodes, edges };
}
