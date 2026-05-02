// ============================================================
// ShorTree — API Data Transfer Objects (DTOs)
//
// These types describe the JSON shapes that cross the
// API boundary in BOTH directions:
//   → Request bodies  (what the client sends)
//   → Response bodies (what the server returns)
//
// Rules:
//  1. These are PLAIN objects — no Prisma types here.
//  2. Dates are serialized as ISO strings (JSON standard).
//  3. Internal DB fields (e.g. raw FKs) are omitted
//     from responses where not needed by the UI.
//  4. Both src/app/api/v1/ AND src/services/ import
//     from here — it is the shared contract.
// ============================================================

import type { ApiEnvelope } from '@/lib/api/response';

// Re-export the envelope so services only need one import.
export type { ApiEnvelope };

// ─────────────────────────────────────────────
// TREE
// ─────────────────────────────────────────────

/** What the API returns for a Tree record. */
export interface TreeDto {
  id: string;
  slug: string;
  shortCode: string;
  name: string;
  description: string | null;
  is_public: boolean;
  about_text: string | null;
  main_surnames: string[];
  created_at: string; // ISO 8601
  updated_at: string;
}

/** Body for POST /api/v1/trees */
export interface CreateTreeBody {
  name: string;
  description?: string;
  is_public?: boolean;
}

/** Body for PATCH /api/v1/trees/:id */
export interface UpdateTreeBody {
  name?: string;
  description?: string;
  is_public?: boolean;
}

/**
 * About payload returned by GET /api/v1/trees/:treeId/about.
 * Only the fields needed by the About page — keeps the surface tight.
 */
export interface TreeAboutDto {
  id: string;
  about_text: string | null;
  main_surnames: string[];
}

/**
 * Body for PATCH /api/v1/trees/:treeId/about.
 * Both fields optional so callers can update either independently.
 * `about_text: null` explicitly clears the description.
 */
export interface UpdateTreeAboutBody {
  about_text?: string | null;
  main_surnames?: string[];
}

// ─────────────────────────────────────────────
// PERSON
// ─────────────────────────────────────────────

export interface PersonDto {
  id: string;
  tree_id: string;
  first_name: string;
  last_name: string | null;
  maiden_name: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  birth_date: string | null;
  death_date: string | null;
  birth_place: string | null;
  bio: string | null;
  profile_image: string | null;
  first_name_he: string | null;
  last_name_he: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonBody {
  tree_id: string;
  first_name: string;
  last_name?: string;
  maiden_name?: string;
  gender?: PersonDto['gender'];
  birth_date?: string;
  death_date?: string;
  birth_place?: string;
  bio?: string;
  first_name_he?: string;
  last_name_he?: string;
  /** Supabase Storage path (not a full URL). Set after image upload. */
  profile_image?: string;
}

export type UpdatePersonBody = Partial<Omit<CreatePersonBody, 'tree_id'>>;

// ─────────────────────────────────────────────
// RELATIONSHIP
// ─────────────────────────────────────────────

export type RelationshipType =
  | 'SPOUSE'
  | 'PARENT_CHILD'
  | 'SIBLING'
  | 'ENGAGED'
  | 'DIVORCED'
  | 'ADOPTED_PARENT';

export interface RelationshipDto {
  id: string;
  tree_id: string;
  person1_id: string;
  person2_id: string;
  relationship_type: RelationshipType;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRelationshipBody {
  tree_id: string;
  person1_id: string;
  person2_id: string;
  relationship_type: RelationshipType;
  start_date?: string;
  end_date?: string;
  notes?: string;
}
