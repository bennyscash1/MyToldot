import type { DashboardPerson, MiniTreePerson } from '../types';

export const BOX_W = 130;
export const BOX_H = 34;
export const BOX_RX = 8;
export const UNION_R = 4;

const ROW_PARENT_Y = 8;
const ROW_CURRENT_Y = 85;
const ROW_CHILDREN_Y = 155;
const SVG_W = 540;
const SVG_H = 200;

export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  isCurrent: boolean;
  isOverflow?: boolean;
  isAdoptive?: boolean;
  isDivorcedSpouse?: boolean;
  clickable: boolean;
}

export interface LayoutSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed?: boolean;
}

export interface LayoutCircle {
  cx: number;
  cy: number;
  r: number;
}

export interface MiniTreeLayout {
  viewBox: string;
  boxes: LayoutBox[];
  segments: LayoutSegment[];
  circles: LayoutCircle[];
}

export function computeMiniTreeLayout(person: DashboardPerson): MiniTreeLayout {
  const boxes: LayoutBox[] = [];
  const segments: LayoutSegment[] = [];
  const circles: LayoutCircle[] = [];

  const parents = orderParentsRtl(person.relatives.parents);
  const spouse = pickDisplaySpouse(person);
  const children = person.relatives.children;
  const overflow = person.relatives.childrenOverflow;

  const hasParents = parents.length > 0;
  const hasSpouse = spouse != null;
  const hasChildren = children.length > 0 || overflow > 0;

  const currentY = hasParents ? ROW_CURRENT_Y : ROW_PARENT_Y + 40;
  const childrenY = hasChildren
    ? hasParents || hasSpouse
      ? ROW_CHILDREN_Y
      : currentY + 70
    : null;

  const currentBox = placeBox(
    person.id,
    person.displayName,
    SVG_W / 2 + BOX_W / 2,
    currentY,
    true,
    false,
  );
  boxes.push(currentBox);

  if (hasSpouse && spouse) {
    const spouseBox = placeBox(
      spouse.id,
      spouse.displayName,
      currentBox.x - BOX_W - 24,
      currentY,
      false,
      false,
      { isDivorcedSpouse: spouse.isDivorcedSpouse },
    );
    boxes.push(spouseBox);

    const y = currentY + BOX_H / 2;
    const x1 = spouseBox.x + spouseBox.width;
    const x2 = currentBox.x;
    segments.push({ x1, y1: y, x2, y2: y, dashed: spouse.isDivorcedSpouse });
    circles.push({ cx: (x1 + x2) / 2, cy: y, r: UNION_R });
  } else if (!hasParents) {
    currentBox.x = SVG_W / 2 - BOX_W / 2;
  }

  let parentUnion: { x: number; y: number } | null = null;

  if (hasParents) {
    const parentBoxes = distributeRow(parents, ROW_PARENT_Y, SVG_W);
    for (const pb of parentBoxes) {
      boxes.push(pb);
    }

    if (parents.length === 1) {
      const p = parentBoxes[0]!;
      const px = p.x + p.width / 2;
      const py = p.y + p.height;
      const tx = currentBox.x + currentBox.width / 2;
      segments.push({ x1: px, y1: py, x2: px, y2: py + 28 });
      segments.push({ x1: px, y1: py + 28, x2: tx, y2: py + 28 });
      segments.push({ x1: tx, y1: py + 28, x2: tx, y2: currentBox.y });
    } else if (parents.length >= 2) {
      const left = parentBoxes[0]!;
      const right = parentBoxes[parentBoxes.length - 1]!;
      const leftCx = left.x + left.width / 2;
      const rightCx = right.x + right.width / 2;
      const midY = left.y + left.height + 18;
      segments.push({
        x1: leftCx,
        y1: left.y + left.height,
        x2: leftCx,
        y2: midY,
      });
      segments.push({
        x1: rightCx,
        y1: right.y + right.height,
        x2: rightCx,
        y2: midY,
      });
      segments.push({ x1: leftCx, y1: midY, x2: rightCx, y2: midY });
      parentUnion = { x: (leftCx + rightCx) / 2, y: midY };
      circles.push({ cx: parentUnion.x, cy: parentUnion.y, r: UNION_R });
      const dropX = currentBox.x + currentBox.width / 2;
      segments.push({
        x1: parentUnion.x,
        y1: parentUnion.y,
        x2: dropX,
        y2: parentUnion.y,
      });
      segments.push({
        x1: dropX,
        y1: parentUnion.y,
        x2: dropX,
        y2: currentBox.y,
      });
    }
  }

  if (childrenY != null && (children.length > 0 || overflow > 0)) {
    const rowPeople: Array<{
      id: string;
      displayName: string;
      isAdoptive?: boolean;
      isDivorcedSpouse?: boolean;
    }> = children.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      isAdoptive: c.isAdoptive,
    }));
    if (overflow > 0) {
      rowPeople.push({ id: '__overflow__', displayName: `+${overflow}` });
    }
    const childBoxes = distributeRow(rowPeople, childrenY, SVG_W);
    boxes.push(...childBoxes);

    const visibleChildBoxes = childBoxes.filter((b) => !b.isCurrent);

    if (visibleChildBoxes.length > 0) {
      const unionX = hasSpouse
        ? (boxes.find((b) => b.id === spouse!.id)!.x +
            boxes.find((b) => b.id === spouse!.id)!.width +
            currentBox.x) /
          2
        : currentBox.x + currentBox.width / 2;
      const unionY = currentY + BOX_H / 2;
      const busY = childrenY - 14;

      if (hasSpouse) {
        segments.push({
          x1: unionX,
          y1: unionY,
          x2: unionX,
          y2: busY,
        });
      } else {
        const fromY = hasParents ? currentBox.y : currentBox.y + BOX_H;
        segments.push({
          x1: unionX,
          y1: fromY,
          x2: unionX,
          y2: busY,
        });
      }

      const xs = visibleChildBoxes.map((b) => b.x + b.width / 2);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      segments.push({ x1: minX, y1: busY, x2: maxX, y2: busY });

      for (const cb of visibleChildBoxes) {
        const cx = cb.x + cb.width / 2;
        segments.push({ x1: cx, y1: busY, x2: cx, y2: cb.y });
      }
    }
  }

  return {
    viewBox: `0 0 ${SVG_W} ${SVG_H}`,
    boxes,
    segments,
    circles,
  };
}

function orderParentsRtl(parents: MiniTreePerson[]): MiniTreePerson[] {
  if (parents.length <= 1) return parents;
  const males = parents.filter((p) => p.gender === 'MALE');
  const females = parents.filter((p) => p.gender === 'FEMALE');
  const rest = parents.filter((p) => p.gender !== 'MALE' && p.gender !== 'FEMALE');
  if (males.length && females.length) {
    return [...females, ...rest, ...males];
  }
  return [...parents].reverse();
}

function pickDisplaySpouse(person: DashboardPerson): MiniTreePerson | null {
  const active = person.relatives.spouses.filter((s) => !s.isDivorcedSpouse);
  if (active[0]) return active[0];
  return person.relatives.spouses[0] ?? null;
}

function distributeRow(
  people: Array<{ id: string; displayName: string; isAdoptive?: boolean; isDivorcedSpouse?: boolean }>,
  y: number,
  width: number,
): LayoutBox[] {
  const count = people.length;
  if (count === 0) return [];
  const gap = 16;
  const totalW = count * BOX_W + (count - 1) * gap;
  let startX = (width - totalW) / 2;
  if (startX < 4) startX = 4;

  return people.map((p, i) =>
    placeBox(
      p.id,
      p.displayName,
      startX + i * (BOX_W + gap),
      y,
      false,
      p.id !== '__overflow__',
      {
        isAdoptive: p.isAdoptive,
        isDivorcedSpouse: p.isDivorcedSpouse,
        isOverflow: p.id === '__overflow__',
      },
    ),
  );
}

function placeBox(
  id: string,
  label: string,
  x: number,
  y: number,
  isCurrent: boolean,
  clickable: boolean,
  flags?: { isAdoptive?: boolean; isDivorcedSpouse?: boolean; isOverflow?: boolean },
): LayoutBox {
  return {
    id,
    x,
    y,
    width: BOX_W,
    height: BOX_H,
    label,
    isCurrent,
    isOverflow: flags?.isOverflow,
    isAdoptive: flags?.isAdoptive,
    isDivorcedSpouse: flags?.isDivorcedSpouse,
    clickable: clickable && !isCurrent && !flags?.isOverflow,
  };
}
