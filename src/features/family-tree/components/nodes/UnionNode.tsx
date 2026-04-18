'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';

import type { UnionNodeData } from '../../lib/types';
import { UNION_NODE_HEIGHT, UNION_NODE_WIDTH } from '../../lib/constants';

// ────────────────────────────────────────────────────────────────
// UnionNode
//
// The small horizontal pill that sits between two spouses. It exists as a
// real node (not a pure edge) so:
//   1. Child lines visibly originate from the midpoint between the parents.
//   2. ELK can use it as a layout anchor — each union's barycenter sits
//      between its spouses, which is what pulls spouses next to each other.
//
// Rendered as a near-invisible dot for couple/coparent unions, fully hidden
// for solo unions (they're just a math anchor with no real-world meaning).
// Divorced couples get a dashed muted tone.
// ────────────────────────────────────────────────────────────────

function UnionNodeInner({ data }: NodeProps) {
  const { meta } = data as unknown as UnionNodeData;

  const visible = meta.kind !== 'solo';

  return (
    <div
      style={{ width: UNION_NODE_WIDTH, height: UNION_NODE_HEIGHT }}
      className={clsx(
        'rounded-full',
        !visible && 'opacity-0',
        visible && !meta.is_divorced && 'bg-slate-400',
        meta.is_divorced && 'bg-slate-300 opacity-60',
      )}
      aria-hidden="true"
    >
      <Handle
        id="spouse-left"
        type="target"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        id="spouse-right"
        type="target"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      <Handle
        id="children"
        type="source"
        position={Position.Bottom}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

export const UnionNode = memo(UnionNodeInner);
