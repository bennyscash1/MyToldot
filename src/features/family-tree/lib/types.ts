import type { Node, Edge } from '@xyflow/react';

// ────────────────────────────────────────────────────────────────
// Domain input (mirror of the server query payload — re-declared here so
// client code doesn't reach into server-only modules).
// ────────────────────────────────────────────────────────────────

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export type RelationshipType =
  | 'SPOUSE'
  | 'PARENT_CHILD'
  | 'SIBLING'
  | 'ENGAGED'
  | 'DIVORCED'
  | 'ADOPTED_PARENT';

export interface PersonRow {
  id: string;
  first_name: string;
  last_name: string | null;
  maiden_name: string | null;
  first_name_he: string | null;
  last_name_he: string | null;
  gender: Gender;
  birth_date: Date | string | null;
  death_date: Date | string | null;
  is_deceased: boolean;
  birth_date_hebrew?: string | null;
  birth_year_hebrew?: string | null;
  death_date_hebrew?: string | null;
  death_year_hebrew?: string | null;
  birth_place: string | null;
  /** Optional — may be loaded from DB even if the canvas omits it in the hash. */
  bio?: string | null;
  profile_image: string | null;
}

export interface RelationshipRow {
  id: string;
  relationship_type: RelationshipType;
  person1_id: string;
  person2_id: string;
  start_date: Date | string | null;
  end_date: Date | string | null;
}

// ────────────────────────────────────────────────────────────────
// Bipartite graph produced by buildBipartiteGraph()
// ────────────────────────────────────────────────────────────────

/** Metadata attached to a union node — used both for rendering decisions
 *  (divorced styling) and for the "+child" popover (knows the parents). */
export interface UnionMeta {
  kind: 'couple' | 'solo' | 'coparent';
  parent_ids: [string] | [string, string];
  spouse_relationship_id: string | null;
  is_divorced: boolean;
  is_engaged: boolean;
}

export interface BipartiteNode {
  id: string;
  kind: 'person' | 'union';
  /** Generation index relative to focal person. 0 = focal row, negative = ancestors, positive = descendants. */
  gen: number;
  /** Rendered size — must match the React component's CSS box for ELK to route edges correctly. */
  width: number;
  height: number;
  /** Type-specific payload. */
  person?: PersonRow;
  union?: UnionMeta;
}

export type PlaceholderKind = 'add-parent' | 'add-spouse' | 'add-child' | 'add-sibling';

export interface PlaceholderMeta {
  kind: PlaceholderKind;
  /** For add-parent: child id. For add-spouse: existing spouse id. For add-child: parent union id. For add-sibling: existing sibling id. */
  anchor_id: string;
  /** For add-child: the parent ids the popover should submit. */
  parent_ids?: [string] | [string, string];
}

export interface BipartiteEdge {
  id: string;
  source: string;
  target: string;
  kind: 'spouse' | 'child';
  /** For SPOUSE edges, mirrors the underlying relationship state so the edge can render dashed/red for DIVORCED. */
  meta?: { is_divorced?: boolean; is_engaged?: boolean };
}

export interface BipartiteGraph {
  nodes: BipartiteNode[];
  edges: BipartiteEdge[];
  /** Map personId → unionId(s) the person participates in as a spouse. */
  person_unions: Map<string, string[]>;
  /** Map personId → unionId their children hang from (may differ per child; this is the *primary* one, used by placeholder synthesis). */
  parent_unions_of_person: Map<string, string | null>;
}

// ────────────────────────────────────────────────────────────────
// React Flow node data payloads (what custom node components receive)
// ────────────────────────────────────────────────────────────────

export type PersonNodeData = {
  person: PersonRow;
  is_focal: boolean;
};

export type UnionNodeData = {
  meta: UnionMeta;
};

export type FlowNode =
  | Node<PersonNodeData, 'person'>
  | Node<UnionNodeData, 'union'>;

export type FlowEdge = Edge;
