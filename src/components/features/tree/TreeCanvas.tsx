'use client';

import { useLocale } from 'next-intl';

import {
  ReactFlow,
  Panel,
  useReactFlow,
  type NodeMouseHandler,
  type NodeTypes,
  type Edge,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

const controlBtnClass =
  'flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-[#e8e6d8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3e5045]/40 disabled:opacity-40';

function CanvasZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-slate-200/80 bg-[#f4f3e9] p-1 shadow-sm"
      dir="ltr"
    >
      <button
        type="button"
        className={controlBtnClass}
        title="התאמה למסך"
        aria-label="התאמה למסך"
        onClick={() => fitView({ padding: 0.2, maxZoom: 1.25, duration: 200 })}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      </button>
      <button
        type="button"
        className={controlBtnClass}
        title="הקטן"
        aria-label="הקטן"
        onClick={() => zoomOut({ duration: 150 })}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        className={controlBtnClass}
        title="הגדל"
        aria-label="הגדל"
        onClick={() => zoomIn({ duration: 150 })}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

export interface TreeCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodeClick: NodeMouseHandler;
  /** True when there are no people — show centered “first person” affordance. */
  showEmptyAdd: boolean;
  onAddFirstPerson?: () => void;
  /** Shown while ELK recomputes layout. */
  isLayoutLoading?: boolean;
  layoutError?: Error | null;
}

/**
 * White pan/zoom surface with floating zoom controls. Optional empty-state CTA.
 * Expects a parent `ReactFlowProvider` (see `FamilyTreeViewer`).
 */
export function TreeCanvas({
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  showEmptyAdd,
  onAddFirstPerson,
  isLayoutLoading,
  layoutError,
}: TreeCanvasProps) {
  const locale = useLocale();
  const overlayDir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="relative h-full min-h-[480px] w-full bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        fitView={!showEmptyAdd}
        fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }}
        minZoom={0.25}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={onNodeClick}
        className="!bg-white toldot-flow"
      >
        {!showEmptyAdd && (
          <Panel position="bottom-right" className="!m-4">
            <CanvasZoomControls />
          </Panel>
        )}
      </ReactFlow>

      {showEmptyAdd && onAddFirstPerson && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white"
          aria-hidden={false}
        >
          <button
            type="button"
            onClick={onAddFirstPerson}
            className="pointer-events-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#3e5045] text-5xl font-light leading-none text-white shadow-lg transition hover:bg-[#323d36] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#3e5045]/35"
            title="הוספת אדם ראשון"
            aria-label="הוספת אדם ראשון"
          >
            +
          </button>
        </div>
      )}

      {isLayoutLoading && !showEmptyAdd && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-slate-900/75 px-3 py-1 text-xs text-white" dir={overlayDir}>
            מסדר את העץ…
          </span>
        </div>
      )}

      {layoutError && (
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-rose-600 px-3 py-1 text-xs text-white" dir={overlayDir}>
            שגיאת פריסה: {layoutError.message}
          </span>
        </div>
      )}
    </div>
  );
}
