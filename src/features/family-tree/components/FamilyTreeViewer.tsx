'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

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
}

const NODE_TYPES: NodeTypes = {
  person: PersonCardNode,
  union: UnionNode,
  placeholder: PlaceholderNode,
};

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.85 };

function FamilyTreeViewerInner({
  persons,
  relationships,
  initialFocalId,
  canEdit,
  onSelectPerson,
  onAddRelative,
}: Omit<FamilyTreeViewerProps, 'treeId'>) {
  const [focalId, setFocalId] = useState<string | null>(initialFocalId);

  const { nodes, edges, isLoading, error } = useElkLayout({
    persons,
    relationships,
    focalId,
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

  const emptyState = useMemo(
    () =>
      persons.length === 0 && (
        <div className="flex h-full items-center justify-center text-slate-500" dir="rtl">
          העץ ריק. הוסיפו אדם ראשון כדי להתחיל.
        </div>
      ),
    [persons.length],
  );

  return (
    <div className="relative h-full min-h-[480px] w-full">
      {emptyState}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        defaultViewport={DEFAULT_VIEWPORT}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        className="shortree-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-white/80" />
      </ReactFlow>

      {isLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full bg-slate-900/70 px-3 py-1 text-xs text-white" dir="rtl">
            מסדר את העץ…
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-0 top-2 flex justify-center">
          <span className="rounded-full bg-rose-600 px-3 py-1 text-xs text-white" dir="rtl">
            שגיאת פריסה: {error.message}
          </span>
        </div>
      )}
    </div>
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
