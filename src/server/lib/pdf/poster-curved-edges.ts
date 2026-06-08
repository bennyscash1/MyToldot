import type { PedigreeChildEdgeData } from '@/features/family-tree/lib/pedigreeChildEdges';

function bezierV(x: number, y1: number, y2: number, endX: number, endY: number): string {
  const c1y = y1 + (y2 - y1) * 0.55;
  const c2y = y1 + (y2 - y1) * 0.75;
  return `C ${x} ${c1y}, ${endX} ${c2y}, ${endX} ${endY}`;
}

/** Organic curved pedigree connector for the heritage poster. */
export function posterCurvedChildPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  data: PedigreeChildEdgeData,
): string {
  if (data.variant === 'solo') {
    return `M ${sourceX} ${sourceY} ${bezierV(sourceX, sourceY, targetY, targetX, targetY)}`;
  }

  const busY = data.busY ?? targetY;
  const minX = data.siblingMinX ?? Math.min(sourceX, targetX);
  const maxX = data.siblingMaxX ?? Math.max(sourceX, targetX);

  if (!data.drawSharedTrunk) {
    return `M ${targetX} ${busY} ${bezierV(targetX, busY, targetY, targetX, targetY)}`;
  }

  if (data.singleChild) {
    return `M ${sourceX} ${sourceY} ${bezierV(sourceX, sourceY, targetY, targetX, targetY)}`;
  }

  const parts = [
    `M ${sourceX} ${sourceY}`,
    bezierV(sourceX, sourceY, busY, sourceX, busY),
  ];
  if (Math.abs(minX - maxX) >= 1) {
    parts.push(`L ${minX} ${busY}`, `L ${maxX} ${busY}`);
  }
  parts.push(`L ${targetX} ${busY}`, bezierV(targetX, busY, targetY, targetX, targetY));
  return parts.join(' ');
}

export function posterCurvedSpousePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} Q ${midX} ${y1 - 4}, ${x2} ${y2}`;
}

export function buildTrunkConvergencePaths(
  childBottomPoints: Array<{ x: number; y: number }>,
  trunkX: number,
  trunkTopY: number,
  trunkBottomY: number,
): string[] {
  if (childBottomPoints.length === 0) return [];

  const paths: string[] = [];
  for (const pt of childBottomPoints) {
    paths.push(
      `M ${pt.x} ${pt.y} ${bezierV(pt.x, pt.y, trunkTopY, trunkX, trunkTopY)}`,
    );
  }
  paths.push(
    `M ${trunkX} ${trunkTopY} ${bezierV(trunkX, trunkTopY, trunkBottomY, trunkX, trunkBottomY)}`,
  );
  return paths;
}
