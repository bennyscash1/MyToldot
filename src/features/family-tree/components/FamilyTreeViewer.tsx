'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider, type NodeMouseHandler, type NodeTypes } from '@xyflow/react';

import { TreeCanvas } from '@/components/features/tree/TreeCanvas';
import { useElkLayout } from '../hooks/useElkLayout';
import { PersonCardNode } from './nodes/PersonCardNode';
import { UnionNode } from './nodes/UnionNode';
import { PlaceholderNode } from './nodes/PlaceholderNode';
import type {
  FlowNode,
  PersonRow,
  PlaceholderNodeData,
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
  onAddRelative?: (meta: PlaceholderNodeData['meta'], screenX: number, screenY: number) => void;
  /** When the tree has no people yet — centered “+” creates the first person and opens the editor. */
  onAddFirstPerson?: () => void;
}

const NODE_TYPES: NodeTypes = {
  person: PersonCardNode,
  union: UnionNode,
  placeholder: PlaceholderNode,
};

function FamilyTreeViewerInner({
  persons,
  relationships,
  initialFocalId,
  canEdit,
  onSelectPerson,
  onAddRelative,
  onAddFirstPerson,
}: Omit<FamilyTreeViewerProps, 'treeId'>) {
  const [focalId, setFocalId] = useState<string | null>(initialFocalId);

  useEffect(() => {
    if (persons.length === 0) return;
    if (!focalId) setFocalId(persons[0]?.id ?? null);
  }, [persons, focalId]);

  /** ELK + placeholders need a focal immediately; state may lag one frame after the first person is added. */
  const layoutFocalId = useMemo(
    () => (persons.length === 0 ? null : focalId ?? persons[0]?.id ?? null),
    [persons, focalId],
  );

  const { nodes, edges, isLoading, error } = useElkLayout({
    persons,
    relationships,
    focalId: layoutFocalId,
    showPlaceholders: canEdit,
  });

  const onNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      const typed = node as FlowNode;
      if (typed.type === 'person') {
        onSelectPerson?.(typed.id);
        if (typed.id !== focalId) setFocalId(typed.id);
        return;
      }
      if (typed.type === 'placeholder') {
        onAddRelative?.(typed.data.meta, event.clientX, event.clientY);
      }
    },
    [focalId, onSelectPerson, onAddRelative],
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
