import { prisma } from '@/lib/prisma';
import type { RelationshipType } from '@/types/api';

// ──────────────────────────────────────────────
// Strict Lineage Enforcement
//
// When a Tree has `strict_lineage_enforcement = true`,
// adding a person as PARENT or SIBLING of someone
// who joined the family only through marriage (an
// "in-law") is blocked or warned about.
//
// Definitions used here:
//  • Blood member  — connected by PARENT_CHILD, SIBLING, or ADOPTED_PARENT
//  • In-law        — connected only via SPOUSE, ENGAGED, or DIVORCED
//
// Full enforcement is applied at the RELATIONSHIP level (Phase 5).
// This module exposes the shared check so both the persons route
// and the future relationships route call the same logic.
// ──────────────────────────────────────────────

/** Relationship types that constitute a blood/adoptive link. */
const BLOOD_TYPES: RelationshipType[] = [
  'PARENT_CHILD',
  'SIBLING',
  'ADOPTED_PARENT',
];

/** Relationship types that constitute a marriage/partnership link only. */
const MARRIAGE_TYPES: RelationshipType[] = ['SPOUSE', 'ENGAGED', 'DIVORCED'];

export interface LineageCheckResult {
  /** Whether the operation is allowed. */
  allowed: boolean;
  /**
   * HTTP-friendly reason code when `allowed` is false.
   * Use for structured error messages in route handlers.
   */
  code?: 'STRICT_LINEAGE_VIOLATION';
  /** Human-readable reason (English). */
  reason?: string;
}

/**
 * Checks whether creating a relationship of `relationshipType`
 * between `person1Id` and `person2Id` is permitted under the
 * tree's lineage enforcement policy.
 *
 * Rules when strict_lineage_enforcement = true:
 *  • SPOUSE / ENGAGED / DIVORCED  → always allowed
 *  • PARENT_CHILD / SIBLING / ADOPTED_PARENT involving a person
 *    who is only connected to the tree via marriage → BLOCKED
 *
 * @param treeId            The tree being modified.
 * @param person2Id         The target person (being assigned a role).
 * @param relationshipType  The proposed relationship.
 */
export async function checkLineageEnforcement(
  treeId: string,
  person2Id: string,
  relationshipType: RelationshipType,
): Promise<LineageCheckResult> {
  // 1. Is strict mode active for this tree?
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { strict_lineage_enforcement: true },
  });

  if (!tree?.strict_lineage_enforcement) {
    return { allowed: true };
  }

  // 2. Marriage-type relationships are always permitted.
  if ((MARRIAGE_TYPES as string[]).includes(relationshipType)) {
    return { allowed: true };
  }

  // 3. For blood/adoptive links, check if person2 is exclusively
  //    an in-law (has no blood links — only marriage links).
  const existingRelationships = await prisma.relationship.findMany({
    where: {
      tree_id: treeId,
      OR: [{ person1_id: person2Id }, { person2_id: person2Id }],
    },
    select: { relationship_type: true },
  });

  if (existingRelationships.length === 0) {
    // New person, no existing links — always fine.
    return { allowed: true };
  }

  const hasBloodLink = existingRelationships.some((r) =>
    (BLOOD_TYPES as string[]).includes(r.relationship_type),
  );

  if (!hasBloodLink) {
    return {
      allowed: false,
      code: 'STRICT_LINEAGE_VIOLATION',
      reason:
        'Strict lineage mode is active. This person is connected only ' +
        'by marriage and cannot be assigned a blood/adoptive relationship.',
    };
  }

  return { allowed: true };
}

/**
 * Lightweight helper — returns whether strict mode is on for a tree.
 * Use in forms to show the "strict mode active" banner.
 */
export async function isStrictLineageActive(treeId: string): Promise<boolean> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { strict_lineage_enforcement: true },
  });
  return tree?.strict_lineage_enforcement ?? false;
}
