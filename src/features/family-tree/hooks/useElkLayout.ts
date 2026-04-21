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
 *  - A topology hash is computed from (persons ids/gen-relevant fields,
 *    relationships ids+types+endpoints, focal, placeholder flag). Cosmetic
 *    edits like renaming a person don't change the hash → no re-layout.
 *  - Layout runs in an effect (ELK is async / worker-backed). While running,
 *    the previous positioned output is kept so the canvas doesn't flash.
 */
export function useElkLayout({
  persons,
  relationships,
  focalId,
  showPlaceholders = true,
}: UseElkLayoutArgs): UseElkLayoutResult {
  const topoHash = useMemo(() => {
    if (persons.length === 0) return '__empty__';
    return hashTopology(persons, relationships, focalId, showPlaceholders);
  }, [persons, relationships, focalId, showPlaceholders]);

  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastHash = useRef<string | null>(null);

  useEffect(() => {
    // No people → no graph layout. Avoid ELK and the “arranging…” loading state.
    if (persons.length === 0) {
      lastHash.current = '__empty__';
      setLayout(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (topoHash === lastHash.current) return;
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
        lastHash.current = topoHash;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // We only want to re-run when the hash changes; the other deps are
    // encapsulated by it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topoHash, persons.length]);

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
  focalId: string | null,
  showPlaceholders: boolean,
): string {
  // Only topology-relevant fields. Renaming / changing birth_date does NOT
  // invalidate layout — those are cosmetic-only.
  const p = persons
    .map((x) => x.id)
    .sort()
    .join(',');
  const r = relationships
    .map((x) => `${x.id}:${x.relationship_type}:${x.person1_id}>${x.person2_id}`)
    .sort()
    .join('|');
  return `${focalId ?? '-'}|${showPlaceholders ? 1 : 0}|${p}|${r}`;
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

  // Build a position lookup so we can determine which side of the union
  // each spouse is on, and set explicit handle IDs accordingly.
  const posById = new Map(layout.nodes.map((n) => [n.id, n]));

  const edges: FlowEdge[] = layout.edges.map((e) => {
    if (e.kind === 'spouse') {
      // ── Spouse / marriage edge ─────────────────────────────────────────
      // Drawn as a straight horizontal line between the person and the union
      // pill. Because the union is vertically centred in the person row (via
      // UNION_Y_OFFSET in elkLayout.ts), both handles sit at exactly the same
      // Y — so 'straight' produces a clean horizontal rule.
      //
      // We determine which side of the union the person sits on so we can
      // route from the person's facing handle to the union's matching handle:
      //   • person LEFT  of union → person "right" source  → union "spouse-left"  target
      //   • person RIGHT of union → person "left"  source  → union "spouse-right" target
      const person = posById.get(e.source);
      const union  = posById.get(e.target);
      let sourceHandle: string | undefined;
      let targetHandle: string | undefined;
      if (person && union) {
        const personCenterX = person.x + person.width  / 2;
        const unionCenterX  = union.x  + union.width   / 2;
        if (personCenterX <= unionCenterX) {
          sourceHandle = 'right';        // person's right-side source handle
          targetHandle = 'spouse-left';  // union's left-side target handle
        } else {
          sourceHandle = 'left';         // person's left-side source handle
          targetHandle = 'spouse-right'; // union's right-side target handle
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

    // ── Child / descent edge ───────────────────────────────────────────
    // Drawn as an orthogonal step path.  The union's bottom handle drops a
    // vertical line, which then steps horizontally to each child's top
    // handle — producing the classic genealogical "bracket" structure.
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'step',
      sourceHandle: 'children', // union's bottom source handle
      targetHandle: 'top',      // child's top target handle
      className: 'shortree-edge-child',
    } as FlowEdge;
  });

  return { nodes, edges };
}
