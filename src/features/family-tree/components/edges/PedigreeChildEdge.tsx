'use client';

import { memo } from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';

import {
  pedigreeChildPath,
  type PedigreeChildEdgeData,
} from '../../lib/pedigreeChildEdges';

function PedigreeChildEdgeInner(props: EdgeProps & { className?: string }) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    markerEnd,
    style,
    className,
    data,
  } = props;

  const edgeData = (data ?? { variant: 'solo' }) as PedigreeChildEdgeData;
  const path = pedigreeChildPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    edgeData,
  );

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      className={className}
    />
  );
}

export const PedigreeChildEdge = memo(PedigreeChildEdgeInner);
