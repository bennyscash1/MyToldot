import {
  PLACEHOLDER_NODE_WIDTH,
  PLACEHOLDER_NODE_HEIGHT,
  UNION_NODE_WIDTH,
  UNION_NODE_HEIGHT,
} from './constants';
import type { BipartiteGraph, BipartiteNode, BipartiteEdge, UnionMeta } from './types';

// ────────────────────────────────────────────────────────────────
// synthesizePlaceholders
//
// Adds "+" nodes around the focal person so the user can add relatives
// inline. Placeholders are NOT persisted — they live only in the rendered
// graph. They participate in the ELK layout, so when a real person replaces
// one nothing jumps.
//
// Rules (match the MyHeritage reference screenshot):
//   • 0 parents   → one +parent placeholder one gen above
//   • 1 parent    → one +parent placeholder for the missing partner
//   • No spouse   → one +spouse placeholder on the focal's row
//   • Has spouse-union → one +child placeholder one gen below that union
//   • Single-parent child of focal → show +child below a solo union
// ────────────────────────────────────────────────────────────────

export function synthesizePlaceholders(
  graph: BipartiteGraph,
  focalId: string | null,
): { nodes: BipartiteNode[]; edges: BipartiteEdge[] } {
  if (!focalId) return { nodes: [], edges: [] };
  const focal = graph.nodes.find((n) => n.kind === 'person' && n.id === focalId);
  if (!focal) return { nodes: [], edges: [] };

  const nodes: BipartiteNode[] = [];
  const edges: BipartiteEdge[] = [];

  const focalGen = focal.gen;

  // ── +parent placeholders ───────────────────────────────────────────────
  const parentUnionId = graph.parent_unions_of_person.get(focalId) ?? null;
  if (!parentUnionId) {
    // No parents at all → one placeholder parent + a temp union so the future
    // child-edge would geometrically line up with a future spouse-edge.
    const tempUnionId = `ph:union:parents-of:${focalId}`;
    const placeholderParentId = `ph:parent:${focalId}`;
    nodes.push(
      makeUnion(tempUnionId, focalGen - 1, {
        kind: 'solo',
        parent_ids: [placeholderParentId],
        spouse_relationship_id: null,
        is_divorced: false,
        is_engaged: false,
      }),
      makePlaceholder(placeholderParentId, focalGen - 1, {
        kind: 'add-parent',
        anchor_id: focalId,
      }),
    );
    edges.push(
      spouseEdge(placeholderParentId, tempUnionId),
      childEdge(tempUnionId, focalId),
    );
  } else {
    const unionNode = graph.nodes.find((n) => n.id === parentUnionId);
    if (unionNode?.union?.kind === 'solo') {
      // One parent known, other parent missing → +parent slot attached to the
      // existing solo union, upgrading it visually to a couple.
      const placeholderParentId = `ph:parent:${focalId}`;
      nodes.push(
        makePlaceholder(placeholderParentId, unionNode.gen, {
          kind: 'add-parent',
          anchor_id: focalId,
        }),
      );
      edges.push(spouseEdge(placeholderParentId, parentUnionId));
    }
  }

  // ── +spouse placeholder ────────────────────────────────────────────────
  const focalSpouseUnions = graph.person_unions.get(focalId) ?? [];
  if (focalSpouseUnions.length === 0) {
    const tempUnionId = `ph:union:spouse-of:${focalId}`;
    const placeholderSpouseId = `ph:spouse:${focalId}`;
    nodes.push(
      makeUnion(tempUnionId, focalGen, {
        kind: 'couple',
        parent_ids: [focalId, placeholderSpouseId],
        spouse_relationship_id: null,
        is_divorced: false,
        is_engaged: false,
      }),
      makePlaceholder(placeholderSpouseId, focalGen, {
        kind: 'add-spouse',
        anchor_id: focalId,
      }),
    );
    edges.push(
      spouseEdge(focalId, tempUnionId),
      spouseEdge(placeholderSpouseId, tempUnionId),
    );
  }

  // ── +child placeholder ─────────────────────────────────────────────────
  // If focal has a spouse union, add a +child below it. Otherwise, the
  // +spouse placeholder above already creates a temp union — we hang +child
  // off that one instead so the geometry is consistent.
  const childAnchorUnion =
    focalSpouseUnions[0] ?? `ph:union:spouse-of:${focalId}`;
  const childAnchorExists =
    focalSpouseUnions.length > 0 ||
    nodes.some((n) => n.id === childAnchorUnion);
  if (childAnchorExists) {
    const placeholderChildId = `ph:child:${childAnchorUnion}`;
    const parent2 = focalSpouseUnions[0]
      ? (graph.nodes.find((n) => n.id === focalSpouseUnions[0])?.union?.parent_ids
          .find((pid) => pid !== focalId) ?? null)
      : null;
    nodes.push(
      makePlaceholder(placeholderChildId, focalGen + 1, {
        kind: 'add-child',
        anchor_id: childAnchorUnion,
        parent_ids: parent2 ? [focalId, parent2] : [focalId],
      }),
    );
    edges.push(childEdge(childAnchorUnion, placeholderChildId));
  }

  return { nodes, edges };
}

// ── helpers ────────────────────────────────────────────────────────────

function makePlaceholder(
  id: string,
  gen: number,
  placeholder: { kind: 'add-parent' | 'add-spouse' | 'add-child' | 'add-sibling'; anchor_id: string; parent_ids?: [string] | [string, string] },
): BipartiteNode {
  return {
    id,
    kind: 'placeholder',
    gen,
    width: PLACEHOLDER_NODE_WIDTH,
    height: PLACEHOLDER_NODE_HEIGHT,
    placeholder,
  };
}

function makeUnion(id: string, gen: number, union: UnionMeta): BipartiteNode {
  return { id, kind: 'union', gen, width: UNION_NODE_WIDTH, height: UNION_NODE_HEIGHT, union };
}

function spouseEdge(source: string, target: string): BipartiteEdge {
  return { id: `e:sp:${target}:${source}`, source, target, kind: 'spouse' };
}

function childEdge(source: string, target: string): BipartiteEdge {
  return { id: `e:ch:${source}:${target}`, source, target, kind: 'child' };
}
