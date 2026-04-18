'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import type { PlaceholderNodeData } from '../../lib/types';
import {
  PLACEHOLDER_NODE_HEIGHT,
  PLACEHOLDER_NODE_WIDTH,
} from '../../lib/constants';

// ────────────────────────────────────────────────────────────────
// PlaceholderNode
//
// The dashed "+ Add …" card that appears around the focal person for each
// missing slot (parent / spouse / child). Clicking it fires a React Flow
// node-click event; the FamilyTreeViewer listens and opens the appropriate
// popover. No network call happens from inside this component — it stays
// dumb on purpose so forms remain testable in isolation.
// ────────────────────────────────────────────────────────────────

const LABEL: Record<PlaceholderNodeData['meta']['kind'], string> = {
  'add-parent': 'Add parent',
  'add-spouse': 'Add spouse',
  'add-child': 'Add child',
  'add-sibling': 'Add sibling',
};

function PlaceholderNodeInner({ data }: NodeProps) {
  const { meta } = data as unknown as PlaceholderNodeData;

  return (
    <button
      type="button"
      style={{ width: PLACEHOLDER_NODE_WIDTH, height: PLACEHOLDER_NODE_HEIGHT }}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 text-slate-500 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-600"
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />

      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold leading-none text-slate-400">
        +
      </span>
      <span className="text-xs font-medium">{LABEL[meta.kind]}</span>
    </button>
  );
}

export const PlaceholderNode = memo(PlaceholderNodeInner);
