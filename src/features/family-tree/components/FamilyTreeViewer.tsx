'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider, type NodeMouseHandler, type NodeTypes } from '@xyflow/react';

import { TreeCanvas } from '@/components/features/tree/TreeCanvas';
import { useElkLayout } from '../hooks/useElkLayout';
import { PersonCardNode } from './nodes/PersonCardNode';
import { UnionNode } from './nodes/UnionNode';
import type {
  FlowNode,
  PersonRow,
  RelationshipRow,
} from '../lib/types';

export interface FamilyTreeViewerProps {
  treeId: string;
  persons: PersonRow[];
  relationships: RelationshipRow[];
  /** Initial focal person id — supplied by the RSC (linked_person → root → first). */
  initialFocalId: string | null;
  /** Suppresses "+" cards for read-only viewers of public trees. */
  canEdit: boolean;
  onSelectPerson?: (personId: string) => void;
  /** When the tree has no people yet — centered "+" creates the first person and opens the editor. */
  onAddFirstPerson?: () => void;
}

const NODE_TYPES: NodeTypes = {
  person: PersonCardNode,
  union: UnionNode,
};

function FamilyTreeViewerInner({
  persons,
  relationships,
  initialFocalId,
  canEdit,
  onSelectPerson,
  onAddFirstPerson,
}: Omit<FamilyTreeViewerProps, 'treeId'>) {
  // ─── Frozen focal ──────────────────────────────────────────────────────────
  // The layout focal is FROZEN after the first non-null value is captured.
  // It must NEVER change in response to user interaction (clicking a person,
  // opening the edit panel, etc.) — doing so triggers a full ELK re-layout
  // that shifts spouse nodes off their generation row.
  //
  // focalRef is the true stable anchor. focalId (state) mirrors it and exists
  // only so that useElkLayout can detect the one-time null→real-id transition
  // on initial load (when the RSC provides initialFocalId=null for an empty tree).
  const focalRef = useRef<string | null>(initialFocalId);
  const [focalId, setFocalId] = useState<string | null>(initialFocalId);

  useEffect(() => {
    // Only initialise once: when the first person is created but no focal was
    // supplied yet. After focalRef is set it is never changed again.
    if (focalRef.current !== null) return;
    if (persons.length === 0) return;
    const firstId = persons[0]?.id ?? null;
    if (firstId) {
      focalRef.current = firstId; // freeze permanently
      setFocalId(firstId);        // signal the one-time layout re-run
    }
  // persons.length is the only dep: avoids re-running on cosmetic person updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length]);

  /** ELK + placeholders need a focal immediately; state may lag one frame. */
  const layoutFocalId = useMemo(
    () => (persons.length === 0 ? null : focalRef.current ?? persons[0]?.id ?? null),
    // focalId dep ensures this memo re-runs on the one-time null→id transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persons.length, focalId],
  );

  const { nodes, edges, isLoading, error } = useElkLayout({
    persons,
    relationships,
    focalId: layoutFocalId,
  });

  const onNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      const typed = node as FlowNode;
      if (typed.type === 'person') {
        // IMPORTANT: do NOT touch focalId / focalRef here.
        // Changing the focal triggers a full ELK re-layout and causes spouse
        // nodes to drift to the wrong generation row.
        onSelectPerson?.(typed.id);
      }
    },
    [onSelectPerson],
  );

  const showEmptyAdd = persons.length === 0 && Boolean(canEdit && onAddFirstPerson);

  return (
    <TreeCanvas
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={onNodeClick}
      showEmptyAdd={showEmptyAdd}
      onAddFirstPerson={onAddFirstPerson}
      isLayoutLoading={isLoading}
      layoutError={error}
    />
  );
}

/**
 * Public wrapper. `ReactFlowProvider` is required so child components (future
 * side panels, custom edges) can call xyflow hooks outside this tree.
 */
export function FamilyTreeViewer(props: FamilyTreeViewerProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeViewerInner {...props} />
    </ReactFlowProvider>
  );
}
