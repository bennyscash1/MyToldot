import 'server-only';

import { buildBipartiteGraph } from '@/features/family-tree/lib/buildBipartiteGraph';
import { UNION_NODE_HEIGHT } from '@/features/family-tree/lib/constants';
import {
  centerLoneChildrenUnderUnions,
  layoutBipartiteGraph,
  repairSubtreeCollisions,
  type PositionedNode,
} from '@/features/family-tree/lib/elkLayout';
import {
  estimatePosterCardHeight,
  posterTierMetrics,
  POSTER_CONTENT_WIDTH,
  POSTER_FIT_MAX_SCALE,
  POSTER_ROW_GAP,
} from '@/features/family-tree/lib/poster-tier-metrics';
import {
  buildPedigreeChildFlowEdges,
  type PedigreeChildEdgeData,
} from '@/features/family-tree/lib/pedigreeChildEdges';

import {
  buildTrunkConvergencePaths,
  posterCurvedChildPath,
  posterCurvedSpousePath,
} from './poster-curved-edges';
import type { BipartiteEdge, BipartiteGraph, PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';

import { clampPosterBioParagraphs } from './poster-bio-clamp';
import { posterBioDepth } from './poster-bio-depth';
import { relationshipLabelHe } from './poster-relationships';
import { headSpouseIds } from './summarize';
import {
  downloadFromDesignAssets,
  ensureDesignAssetsBucket,
  objectExistsInDesignAssets,
  posterLayoutStoragePath,
  uploadToDesignAssets,
} from './storage-assets';
import type { TreeLayoutPlan, TreeTier } from './types';

export const POSTER_CORE_MAX = 15;

const TREE_CANVAS_PADDING_Y = 24;

export interface PosterTreePersonNode {
  personId: string;
  x: number;
  y: number;
  tier: TreeTier;
  isHead: boolean;
  relationshipLabel: string;
  bioParagraphs: string[];
}

export interface PosterTreeUnionNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  isDivorced: boolean;
}

export interface PosterTreeEdge {
  d: string;
  kind: 'spouse' | 'child' | 'trunk';
  isDivorced?: boolean;
}

export interface PosterGenLabel {
  label: string;
  x: number;
  y: number;
}

export interface PosterTreeLayoutData {
  contentWidth: number;
  canvasHeight: number;
  innerWidth: number;
  innerHeight: number;
  fitScale: number;
  offsetX: number;
  offsetY: number;
  subtitle: string;
  genLabels: PosterGenLabel[];
  persons: PosterTreePersonNode[];
  unions: PosterTreeUnionNode[];
  edges: PosterTreeEdge[];
  overflowPersonIds: string[];
}

const TRUNK_EXTRA_HEIGHT = 80;

interface PersonBioContent {
  relationshipLabel: string;
  paragraphs: string[];
}

function tierForPerson(plan: TreeLayoutPlan, personId: string): TreeTier {
  if (plan.tiers.primary.includes(personId)) return 'primary';
  if (plan.tiers.secondary.includes(personId)) return 'secondary';
  return 'compact';
}

function buildPersonBioMap(
  core: Set<string>,
  fullGraph: BipartiteGraph,
  headId: string,
  personBios: Record<string, string[]>,
  personById: Map<string, PersonRow>,
  minGen: number,
  spouses: Set<string>,
): Map<string, PersonBioContent> {
  const out = new Map<string, PersonBioContent>();
  for (const id of core) {
    const person = personById.get(id);
    if (!person) continue;
    const node = fullGraph.nodes.find((n) => n.id === id && n.kind === 'person');
    const gen = node?.gen ?? 0;
    const depth = posterBioDepth(id, gen, minGen, headId, spouses);
    const paragraphs = clampPosterBioParagraphs(personBios[id] ?? [], depth);
    const relationshipLabel = relationshipLabelHe(fullGraph, id, headId, personById);
    out.set(id, {
      relationshipLabel: paragraphs.length > 0 ? relationshipLabel : '',
      paragraphs,
    });
  }
  return out;
}

function buildGenLabels(
  persons: PositionedNode[],
  minGen: number,
): PosterGenLabel[] {
  const byGen = new Map<number, PositionedNode[]>();
  for (const p of persons) {
    const list = byGen.get(p.gen) ?? [];
    list.push(p);
    byGen.set(p.gen, list);
  }
  return [...byGen.keys()]
    .sort((a, b) => a - b)
    .map((gen) => {
      const row = byGen.get(gen) ?? [];
      const centerX =
        row.reduce((s, p) => s + p.x + p.width / 2, 0) / Math.max(row.length, 1);
      const minY = Math.min(...row.map((p) => p.y));
      return {
        label: `G${gen - minGen + 1}`,
        x: centerX - 18,
        y: minY - 22,
      };
    });
}

/** Clone graph with poster tier width and bio-inclusive height per person (ELK input). */
function applyPosterTierSizes(
  graph: BipartiteGraph,
  plan: TreeLayoutPlan,
  bioById: Map<string, PersonBioContent>,
): BipartiteGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (n.kind !== 'person') return n;
      const tier = tierForPerson(plan, n.id);
      const m = posterTierMetrics(tier);
      const bio = bioById.get(n.id);
      const height = estimatePosterCardHeight(
        tier,
        bio?.paragraphs ?? [],
        bio?.relationshipLabel ?? '',
      );
      return { ...n, width: m.width, height };
    }),
  };
}

/**
 * Stack generations using each row's tallest card (bio-inclusive heights).
 * Spouse handles stay aligned within a row; child lines attach to card bottoms.
 */
function layoutPosterDynamicRows(
  nodeMap: Map<string, PositionedNode>,
  tierById: Map<string, TreeTier>,
): void {
  const personsByGen = new Map<number, PositionedNode[]>();
  for (const node of nodeMap.values()) {
    if (node.kind !== 'person') continue;
    const list = personsByGen.get(node.gen) ?? [];
    list.push(node);
    personsByGen.set(node.gen, list);
  }

  const gens = [...personsByGen.keys()].sort((a, b) => a - b);
  let yCursor = 0;

  for (const gen of gens) {
    const persons = personsByGen.get(gen) ?? [];
    let maxHandle = 0;
    for (const p of persons) {
      const h = posterTierMetrics(tierById.get(p.id) ?? 'secondary').spouseHandleY;
      if (h > maxHandle) maxHandle = h;
    }
    const anchorY = yCursor + maxHandle;

    for (const p of persons) {
      const h = posterTierMetrics(tierById.get(p.id) ?? 'secondary').spouseHandleY;
      p.y = anchorY - h;
    }

    for (const node of nodeMap.values()) {
      if (node.kind !== 'union') continue;
      const parentIds = node.union?.parent_ids ?? [];
      const parentGen = parentIds
        .map((id) => nodeMap.get(id))
        .find((p) => p?.kind === 'person')?.gen;
      if (parentGen !== gen) continue;
      node.y = anchorY - UNION_NODE_HEIGHT / 2;
    }

    let rowBottom = anchorY;
    for (const p of persons) {
      rowBottom = Math.max(rowBottom, p.y + p.height);
    }
    for (const node of nodeMap.values()) {
      if (node.kind !== 'union') continue;
      const parentIds = node.union?.parent_ids ?? [];
      const parentGen = parentIds
        .map((id) => nodeMap.get(id))
        .find((p) => p?.kind === 'person')?.gen;
      if (parentGen !== gen) continue;
      rowBottom = Math.max(rowBottom, node.y + node.height);
    }

    yCursor = rowBottom + POSTER_ROW_GAP;
  }
}

function recenterPosterCoupleUnions(nodeMap: Map<string, PositionedNode>): void {
  for (const node of nodeMap.values()) {
    if (node.kind !== 'union') continue;
    if (node.union?.layout_solo_parent_id) continue;
    const parentIds = node.union?.parent_ids;
    if (!parentIds || parentIds.length !== 2) continue;

    const p1 = nodeMap.get(parentIds[0]);
    const p2 = nodeMap.get(parentIds[1]);
    if (!p1 || !p2) continue;

    const midX = (p1.x + p1.width / 2 + p2.x + p2.width / 2) / 2;
    node.x = midX - node.width / 2;
  }
}

/** Small families: include everyone. Larger trees: BFS cap. */
function selectCorePersonIds(
  graph: BipartiteGraph,
  headId: string,
  headGen: number,
): { core: Set<string>; overflow: string[] } {
  const personNodes = graph.nodes.filter((n) => n.kind === 'person');

  if (personNodes.length <= POSTER_CORE_MAX) {
    return { core: new Set(personNodes.map((n) => n.id)), overflow: [] };
  }

  const personIds = new Set(personNodes.map((n) => n.id));

  function graphNeighbors(personId: string): string[] {
    const next: string[] = [];
    for (const e of graph.edges) {
      if (e.kind === 'spouse' && e.source === personId) {
        const unionId = e.target;
        for (const e2 of graph.edges) {
          if (e2.kind === 'spouse' && e2.target === unionId && e2.source !== personId) {
            next.push(e2.source);
          }
        }
      }
      if (e.kind === 'child') {
        const union = graph.nodes.find((n) => n.id === e.source && n.kind === 'union');
        if (union?.union?.parent_ids.includes(personId)) {
          next.push(e.target);
        }
      }
    }
    return next;
  }

  const queue: string[] = [headId];
  const visited = new Set<string>();
  const order: string[] = [];

  while (queue.length > 0 && order.length < POSTER_CORE_MAX) {
    const id = queue.shift()!;
    if (visited.has(id) || !personIds.has(id)) continue;
    const node = graph.nodes.find((n) => n.id === id);
    if (node?.kind === 'person' && node.gen < headGen) continue;

    visited.add(id);
    order.push(id);

    for (const nid of graphNeighbors(id)) {
      if (!visited.has(nid)) queue.push(nid);
    }
  }

  const core = new Set(order);
  const overflow = personNodes
    .filter((n) => n.gen >= headGen && !core.has(n.id))
    .map((n) => n.id);

  return { core, overflow };
}

function filterGraph(graph: BipartiteGraph, core: Set<string>): BipartiteGraph {
  const keptPersons = graph.nodes.filter((n) => n.kind === 'person' && core.has(n.id));
  const keptUnions = graph.nodes.filter((n) => {
    if (n.kind !== 'union' || !n.union) return false;
    const parentsInCore = n.union.parent_ids.filter((id) => core.has(id));
    if (parentsInCore.length === 0) return false;
    const allParentsInCore = n.union.parent_ids.every((id) => core.has(id));
    const childIn = graph.edges.some(
      (e) => e.kind === 'child' && e.source === n.id && core.has(e.target),
    );
    return allParentsInCore || childIn;
  });
  const keptIds = new Set([...keptPersons, ...keptUnions].map((n) => n.id));
  const edges = graph.edges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

  return {
    nodes: [...keptPersons, ...keptUnions],
    edges,
    person_unions: graph.person_unions,
    parent_unions_of_person: graph.parent_unions_of_person,
  };
}

function posterHandleXY(
  node: PositionedNode,
  handle: string,
  tierById: Map<string, TreeTier>,
): { x: number; y: number } {
  if (node.kind === 'person') {
    const tier = tierById.get(node.id) ?? 'secondary';
    const spouseY = node.y + posterTierMetrics(tier).spouseHandleY;
    switch (handle) {
      case 'left':
        return { x: node.x, y: spouseY };
      case 'right':
        return { x: node.x + node.width, y: spouseY };
      case 'top':
        return { x: node.x + node.width / 2, y: node.y };
      case 'bottom':
        return { x: node.x + node.width / 2, y: node.y + node.height };
      default:
        return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    }
  }
  if (node.kind === 'union') {
    const cy = node.y + node.height / 2;
    switch (handle) {
      case 'spouse-left':
        return { x: node.x, y: cy };
      case 'spouse-right':
        return { x: node.x + node.width, y: cy };
      case 'children':
        return { x: node.x + node.width / 2, y: node.y + node.height };
      default:
        return { x: node.x + node.width / 2, y: cy };
    }
  }
  return { x: node.x, y: node.y };
}

function buildSpouseEdgePaths(
  edges: BipartiteEdge[],
  posById: Map<string, PositionedNode>,
  tierById: Map<string, TreeTier>,
): PosterTreeEdge[] {
  const out: PosterTreeEdge[] = [];
  for (const e of edges) {
    if (e.kind !== 'spouse') continue;
    const person = posById.get(e.source);
    const union = posById.get(e.target);
    if (!person || !union || union.kind !== 'union') continue;

    const isSolo = union.union?.kind === 'solo';
    const isOverflow = Boolean(union.union?.layout_solo_parent_id);
    if (isSolo || isOverflow) continue;

    const personCenterX = person.x + person.width / 2;
    const unionCenterX = union.x + union.width / 2;
    const personHandle = personCenterX <= unionCenterX ? 'right' : 'left';
    const unionHandle = personCenterX <= unionCenterX ? 'spouse-left' : 'spouse-right';

    const from = posterHandleXY(person, personHandle, tierById);
    const to = posterHandleXY(union, unionHandle, tierById);
    out.push({
      d: posterCurvedSpousePath(from.x, from.y, to.x, to.y),
      kind: 'spouse',
      isDivorced: e.meta?.is_divorced,
    });
  }
  return out;
}

function buildChildEdgePaths(
  edges: BipartiteEdge[],
  posById: Map<string, PositionedNode>,
  tierById: Map<string, TreeTier>,
): PosterTreeEdge[] {
  const flowEdges = buildPedigreeChildFlowEdges(edges, posById);
  const out: PosterTreeEdge[] = [];

  for (const fe of flowEdges) {
    const data = fe.data as PedigreeChildEdgeData;
    const sourceNode = posById.get(fe.source);
    const targetNode = posById.get(fe.target);
    if (!sourceNode || !targetNode) continue;

    const sourceHandle = fe.sourceHandle ?? 'bottom';
    const targetHandle = fe.targetHandle ?? 'top';
    const from = posterHandleXY(sourceNode, sourceHandle, tierById);
    const to = posterHandleXY(targetNode, targetHandle, tierById);
    const d = posterCurvedChildPath(from.x, from.y, to.x, to.y, data);
    out.push({ d, kind: 'child' });
  }
  return out;
}

interface LayoutBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function measureLayoutBBox(nodes: PositionedNode[]): LayoutBBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

function normalizeLayoutOrigin(nodes: PositionedNode[]): LayoutBBox {
  const bbox = measureLayoutBBox(nodes);
  for (const n of nodes) {
    n.x -= bbox.minX;
    n.y -= bbox.minY;
  }
  return {
    minX: 0,
    minY: 0,
    maxX: bbox.maxX - bbox.minX,
    maxY: bbox.maxY - bbox.minY,
  };
}

/** Fit plan only — coordinates stay at ELK 1:1 tier sizes; render applies one group transform. */
function computeFitPlan(bbox: LayoutBBox, trunkExtra = 0): {
  fitScale: number;
  offsetX: number;
  offsetY: number;
  innerWidth: number;
  innerHeight: number;
  canvasHeight: number;
} {
  const rawW = Math.max(bbox.maxX, 1);
  const rawH = Math.max(bbox.maxY + trunkExtra, 1);

  const fitScale = Math.min(POSTER_CONTENT_WIDTH / rawW, POSTER_FIT_MAX_SCALE);

  const fittedW = rawW * fitScale;
  const offsetX = (POSTER_CONTENT_WIDTH - fittedW) / 2;
  const offsetY = TREE_CANVAS_PADDING_Y;
  const canvasHeight = Math.ceil(rawH * fitScale + TREE_CANVAS_PADDING_Y * 2);

  return {
    fitScale,
    offsetX,
    offsetY,
    innerWidth: Math.ceil(rawW),
    innerHeight: Math.ceil(rawH),
    canvasHeight,
  };
}

export async function buildPosterTreeLayout(params: {
  persons: PersonRow[];
  relationships: RelationshipRow[];
  headId: string | null;
  plan: TreeLayoutPlan;
  personBios: Record<string, string[]>;
}): Promise<PosterTreeLayoutData | null> {
  const { persons, relationships, headId, plan, personBios } = params;
  if (!headId || persons.length === 0) return null;

  const fullGraph = buildBipartiteGraph(persons, relationships, headId);
  const headNode = fullGraph.nodes.find((n) => n.id === headId && n.kind === 'person');
  const headGen = headNode?.gen ?? 0;

  const { core, overflow } = selectCorePersonIds(fullGraph, headId, headGen);
  const filtered = filterGraph(fullGraph, core);
  if (filtered.nodes.filter((n) => n.kind === 'person').length === 0) return null;

  const personById = new Map(persons.map((p) => [p.id, p]));

  const tierById = new Map<string, TreeTier>();
  for (const id of core) {
    tierById.set(id, tierForPerson(plan, id));
  }

  const minGen = Math.min(
    ...filtered.nodes.filter((n) => n.kind === 'person').map((n) => n.gen),
    0,
  );
  const spouses = headSpouseIds(headId, relationships);
  const bioById = buildPersonBioMap(
    core,
    fullGraph,
    headId,
    personBios,
    personById,
    minGen,
    spouses,
  );
  const genCount = new Set(
    filtered.nodes.filter((n) => n.kind === 'person').map((n) => n.gen),
  ).size;
  const subtitle = `${genCount} דורות | ${core.size} בני משפחה`;

  const graphForElk = applyPosterTierSizes(filtered, plan, bioById);
  const layout = await layoutBipartiteGraph(graphForElk);
  const posById = new Map(layout.nodes.map((n) => [n.id, n]));

  layoutPosterDynamicRows(posById, tierById);
  recenterPosterCoupleUnions(posById);
  repairSubtreeCollisions(posById, layout.edges);
  recenterPosterCoupleUnions(posById);
  centerLoneChildrenUnderUnions(posById, layout.edges);

  const spouseEdges = buildSpouseEdgePaths(layout.edges, posById, tierById);
  const childEdges = buildChildEdgePaths(layout.edges, posById, tierById);
  const allEdges = [...spouseEdges, ...childEdges];

  const bbox = normalizeLayoutOrigin(layout.nodes);
  const personLayouts = layout.nodes.filter((n) => n.kind === 'person');
  const maxGen = Math.max(...personLayouts.map((n) => n.gen));
  const bottomRow = personLayouts.filter((n) => n.gen === maxGen);
  const trunkX = bbox.maxX / 2;
  const trunkTopY = bbox.maxY + 10;
  const trunkBottomY = bbox.maxY + TRUNK_EXTRA_HEIGHT;
  const trunkPaths = buildTrunkConvergencePaths(
    bottomRow.map((p) => ({ x: p.x + p.width / 2, y: p.y + p.height })),
    trunkX,
    trunkTopY,
    trunkBottomY,
  );
  const trunkEdges: PosterTreeEdge[] = trunkPaths.map((d) => ({ d, kind: 'trunk' }));
  const genLabels = buildGenLabels(personLayouts, minGen);
  const fit = computeFitPlan(bbox, TRUNK_EXTRA_HEIGHT);

  const personNodes: PosterTreePersonNode[] = layout.nodes
    .filter((n) => n.kind === 'person')
    .map((n) => {
      const bio = bioById.get(n.id);
      return {
        personId: n.id,
        x: n.x,
        y: n.y,
        tier: tierById.get(n.id) ?? 'secondary',
        isHead: n.id === headId,
        relationshipLabel: bio?.relationshipLabel ?? '',
        bioParagraphs: bio?.paragraphs ?? [],
      };
    });

  const unionNodes: PosterTreeUnionNode[] = layout.nodes
    .filter((n) => n.kind === 'union')
    .map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      visible: n.union?.kind !== 'solo' && !n.union?.layout_solo_parent_id,
      isDivorced: Boolean(n.union?.is_divorced),
    }));

  return {
    contentWidth: POSTER_CONTENT_WIDTH,
    canvasHeight: fit.canvasHeight,
    innerWidth: fit.innerWidth,
    innerHeight: fit.innerHeight,
    fitScale: fit.fitScale,
    offsetX: fit.offsetX,
    offsetY: fit.offsetY,
    persons: personNodes,
    unions: unionNodes,
    subtitle,
    genLabels,
    edges: [...allEdges, ...trunkEdges],
    overflowPersonIds: overflow,
  };
}

function coercePosterTreeLayout(parsed: unknown): PosterTreeLayoutData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as PosterTreeLayoutData;
  if (
    typeof o.contentWidth !== 'number' ||
    !Array.isArray(o.persons) ||
    !Array.isArray(o.edges)
  ) {
    return null;
  }
  return o;
}

/**
 * Build or load cached ELK layout for one epoch.
 * Written during /poster session generation; read on every /print load.
 */
export async function ensurePosterTreeLayout(params: {
  baseStyleId: string;
  treeId: string;
  epoch: string;
  persons: PersonRow[];
  relationships: RelationshipRow[];
  headId: string | null;
  plan: TreeLayoutPlan;
  personBios: Record<string, string[]>;
}): Promise<PosterTreeLayoutData | null> {
  const { baseStyleId, treeId, epoch, ...buildParams } = params;
  const storagePath = posterLayoutStoragePath(baseStyleId, treeId, epoch);

  if (await objectExistsInDesignAssets(storagePath)) {
    const raw = await downloadFromDesignAssets(storagePath);
    if (raw) {
      try {
        const cached = coercePosterTreeLayout(JSON.parse(raw));
        if (cached) return cached;
      } catch {
        // fall through to rebuild
      }
    }
  }

  const layout = await buildPosterTreeLayout(buildParams);
  if (!layout) return null;

  try {
    await ensureDesignAssetsBucket();
    await uploadToDesignAssets({
      path: storagePath,
      body: Buffer.from(JSON.stringify(layout), 'utf8'),
      contentType: 'application/json',
      upsert: true,
    });
  } catch {
    // cache write failure is non-fatal
  }

  return layout;
}
