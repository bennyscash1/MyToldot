import type { BipartiteEdge } from './types';
import type { PositionedNode } from './elkLayout';
import { SIBLING_BAR_CLEAR_MARGIN, UNION_NODE_HEIGHT } from './constants';

export type PedigreeChildEdgeData = {
  variant: 'solo' | 'couple';
  /** Draw union→bus + full-width horizontal bus (once per sibling group). */
  drawSharedTrunk?: boolean;
  busY?: number;
  siblingMinX?: number;
  siblingMaxX?: number;
  /** Single child: no horizontal sibling-bar segment. */
  singleChild?: boolean;
};

/** Lowest Y (viewport) that clears all parent cards for this union. */
function maxParentBottomY(
  unionNode: PositionedNode,
  posById: Map<string, PositionedNode>,
): number {
  const parentIds = unionNode.union?.parent_ids ?? [];
  let maxBottom = unionNode.y + UNION_NODE_HEIGHT;

  for (const pid of parentIds) {
    const p = posById.get(pid);
    if (p?.kind === 'person') {
      maxBottom = Math.max(maxBottom, p.y + p.height);
    }
  }

  // Couple unions list both spouses; solo lists one parent.
  return maxBottom;
}

function siblingBarYBelowParents(
  unionNode: PositionedNode,
  posById: Map<string, PositionedNode>,
  childTops: number[],
  multipleChildren: boolean,
): number {
  const belowParents = maxParentBottomY(unionNode, posById) + SIBLING_BAR_CLEAR_MARGIN;

  if (!multipleChildren) {
    return belowParents;
  }

  const minChildTop = Math.min(...childTops);
  // Keep the bar in the visible gap between parent and child rows.
  return Math.min(belowParents, minChildTop - 12);
}

export function buildPedigreeChildFlowEdges(
  layoutEdges: BipartiteEdge[],
  posById: Map<string, PositionedNode>,
): Array<{
  id: string;
  source: string;
  target: string;
  type: 'pedigreeChild';
  sourceHandle?: string;
  targetHandle?: string;
  className: string;
  data: PedigreeChildEdgeData;
}> {
  const childEdges = layoutEdges.filter((e) => e.kind === 'child');
  const groups = new Map<string, BipartiteEdge[]>();

  for (const e of childEdges) {
    const sourceNode = posById.get(e.source);
    let groupKey = e.source;

    if (sourceNode?.kind === 'union' && sourceNode.union?.kind === 'solo') {
      const parentId = sourceNode.union.parent_ids[0];
      if (parentId) groupKey = `solo:${parentId}`;
    } else if (sourceNode?.kind === 'union' && sourceNode.union?.layout_solo_parent_id) {
      groupKey = `solo:${sourceNode.union.layout_solo_parent_id}`;
    }

    const list = groups.get(groupKey) ?? [];
    list.push(e);
    groups.set(groupKey, list);
  }

  const out: ReturnType<typeof buildPedigreeChildFlowEdges> = [];

  for (const [, edges] of groups) {
    const first = edges[0];
    const sourceNode = posById.get(first.source);
    const layoutSoloParentId = sourceNode?.union?.layout_solo_parent_id;
    const isSolo =
      (sourceNode?.kind === 'union' && sourceNode.union?.kind === 'solo') ||
      Boolean(layoutSoloParentId);

    if (isSolo) {
      const parentId =
        layoutSoloParentId ?? sourceNode!.union!.parent_ids[0];
      for (const e of edges) {
        out.push({
          id: e.id,
          source: parentId && posById.has(parentId) ? parentId : e.source,
          target: e.target,
          type: 'pedigreeChild',
          sourceHandle: 'bottom',
          targetHandle: 'top',
          className: 'shortree-edge-child',
          data: { variant: 'solo' },
        });
      }
      continue;
    }

    const unionNode = sourceNode?.kind === 'union' ? sourceNode : null;
    if (!unionNode) continue;

    const targets = edges.map((e) => {
      const child = posById.get(e.target);
      return {
        edge: e,
        x: child ? child.x + child.width / 2 : 0,
        y: child ? child.y : 0,
      };
    });

    const multipleChildren = edges.length > 1;
    const busY = siblingBarYBelowParents(
      unionNode,
      posById,
      targets.map((t) => t.y),
      multipleChildren,
    );

    const xs = targets.map((t) => t.x);
    const siblingMinX = Math.min(...xs);
    const siblingMaxX = Math.max(...xs);
    const trunkEdgeId = edges
      .map((e) => e.id)
      .sort((a, b) => a.localeCompare(b))[0];

    for (const { edge } of targets) {
      out.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'pedigreeChild',
        sourceHandle: 'children',
        targetHandle: 'top',
        className: 'shortree-edge-child',
        data: {
          variant: 'couple',
          drawSharedTrunk: edge.id === trunkEdgeId,
          busY,
          siblingMinX,
          siblingMaxX,
          singleChild: !multipleChildren,
        },
      });
    }
  }

  return out;
}

/** SVG path for a pedigree child connector. */
export function pedigreeChildPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  data: PedigreeChildEdgeData,
): string {
  if (data.variant === 'solo') {
    if (Math.abs(sourceX - targetX) < 1) {
      return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    }
    const midY = sourceY + (targetY - sourceY) * 0.5;
    return `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
  }

  const busY = data.busY ?? targetY;
  const minX = data.siblingMinX ?? Math.min(sourceX, targetX);
  const maxX = data.siblingMaxX ?? Math.max(sourceX, targetX);

  if (!data.drawSharedTrunk) {
    return `M ${targetX} ${busY} L ${targetX} ${targetY}`;
  }

  // One child: single vertical trunk from the union (no sibling bar / horizontal jog).
  if (data.singleChild) {
    return `M ${sourceX} ${sourceY} L ${sourceX} ${targetY}`;
  }

  const parts = [`M ${sourceX} ${sourceY}`, `L ${sourceX} ${busY}`];
  if (Math.abs(minX - maxX) >= 1) {
    parts.push(`L ${minX} ${busY}`, `L ${maxX} ${busY}`);
  }
  parts.push(`L ${targetX} ${busY}`, `L ${targetX} ${targetY}`);
  return parts.join(' ');
}
