import { normalizeHebrewName } from '@/server/lib/family-discovery/summarize-tree';

import type {
  AmbiguousMatch,
  ExistingFamilyMember,
  FamilyMergeProposal,
  MergeNewPerson,
} from './schema';
import { FamilyMergeProposalSchema } from './schema';

const TEMP_ID_RE = /^new_\d+$/i;

function isTempId(id: string): boolean {
  return TEMP_ID_RE.test(id);
}

function isExistingId(id: string, existingIds: Set<string>): boolean {
  return existingIds.has(id);
}

function anchorIdForPerson(p: MergeNewPerson): string | null {
  switch (p.relation) {
    case 'child':
      return p.parentId ?? null;
    case 'parent':
      return p.childOf ?? null;
    case 'spouse':
      return p.spouseId ?? null;
    case 'sibling':
      return p.siblingOf ?? null;
    default:
      return null;
  }
}

function validateAnchor(
  anchor: string | null,
  existingIds: Set<string>,
  tempIds: Set<string>,
): string | null {
  if (!anchor) return 'missing anchor for relation';
  if (isExistingId(anchor, existingIds) || tempIds.has(anchor)) return null;
  return `unknown anchor id: ${anchor}`;
}

/** Remove newPeople whose normalized name already exists in the tree. */
function dropDuplicatesAgainstExisting(
  newPeople: MergeNewPerson[],
  existingMembers: ExistingFamilyMember[],
): MergeNewPerson[] {
  const existingNames = new Set(
    existingMembers.map((m) => normalizeHebrewName(m.name)),
  );
  return newPeople.filter((p) => !existingNames.has(normalizeHebrewName(p.name)));
}

function validateRelationFields(p: MergeNewPerson): string | null {
  switch (p.relation) {
    case 'child':
      if (!p.parentId) return 'child requires parentId';
      if (p.childOf || p.spouseId || p.siblingOf) return 'child must only use parentId';
      break;
    case 'parent':
      if (!p.childOf) return 'parent requires childOf';
      if (p.parentId || p.spouseId || p.siblingOf) return 'parent must only use childOf';
      break;
    case 'spouse':
      if (!p.spouseId) return 'spouse requires spouseId';
      if (p.parentId || p.childOf || p.siblingOf) return 'spouse must only use spouseId';
      break;
    case 'sibling':
      if (!p.siblingOf) return 'sibling requires siblingOf';
      if (p.parentId || p.childOf || p.spouseId) return 'sibling must only use siblingOf';
      break;
  }
  return null;
}

function detectTempCycles(newPeople: MergeNewPerson[]): boolean {
  const tempIds = new Set(newPeople.map((p) => p.tempId));
  const deps = new Map<string, string[]>();
  for (const p of newPeople) {
    const anchor = anchorIdForPerson(p);
    if (anchor && tempIds.has(anchor)) {
      const list = deps.get(anchor) ?? [];
      list.push(p.tempId);
      deps.set(anchor, list);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(id: string): boolean {
    if (visited.has(id)) return false;
    if (visiting.has(id)) return true;
    visiting.add(id);
    for (const next of deps.get(id) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  for (const id of tempIds) {
    if (dfs(id)) return true;
  }
  return false;
}

function sanitizeAmbiguous(
  ambiguous: AmbiguousMatch[],
  existingIds: Set<string>,
): AmbiguousMatch[] {
  return ambiguous
    .map((a) => ({
      ...a,
      candidateIds: a.candidateIds.filter((id) => existingIds.has(id)),
    }))
    .filter((a) => a.candidateIds.length >= 2);
}

export interface ReconcileResult {
  proposal: FamilyMergeProposal;
  warnings: string[];
}

export function reconcileMergeProposal(
  raw: unknown,
  existingMembers: ExistingFamilyMember[],
): ReconcileResult {
  const parsed = FamilyMergeProposalSchema.parse(raw);
  const warnings: string[] = [];
  const existingIds = new Set(existingMembers.map((m) => m.id));

  if (parsed.matchedTo && !existingIds.has(parsed.matchedTo.id)) {
    parsed.matchedTo = null;
    warnings.push('matchedTo id was invalid and cleared');
  }

  const tempIds = new Set<string>();
  const seenTemps = new Set<string>();
  const cleanedPeople: MergeNewPerson[] = [];

  for (const p of parsed.newPeople) {
    const normTemp = p.tempId.toLowerCase();
    if (seenTemps.has(normTemp)) continue;
    seenTemps.add(normTemp);
    tempIds.add(p.tempId);

    const relErr = validateRelationFields(p);
    if (relErr) {
      warnings.push(`Skipped ${p.tempId}: ${relErr}`);
      continue;
    }

    const anchor = anchorIdForPerson(p);
    const anchorErr = validateAnchor(anchor, existingIds, tempIds);
    if (anchorErr) {
      warnings.push(`Skipped ${p.tempId}: ${anchorErr}`);
      continue;
    }

    cleanedPeople.push({ ...p, tempId: p.tempId });
  }

  let newPeople = dropDuplicatesAgainstExisting(cleanedPeople, existingMembers);
  if (newPeople.length < cleanedPeople.length) {
    warnings.push('Removed newPeople that duplicate existing names');
  }

  if (detectTempCycles(newPeople)) {
    warnings.push('Detected cycle in tempId dependencies; flagged for review');
    parsed.needsReview = true;
  }

  const ambiguousMatches = sanitizeAmbiguous(parsed.ambiguousMatches, existingIds);
  if (ambiguousMatches.length > 0) {
    parsed.needsReview = true;
  }

  const ambiguousTempIds = new Set(ambiguousMatches.map((a) => a.tempId));

  const proposal: FamilyMergeProposal = {
    matchedTo: parsed.matchedTo ?? null,
    newPeople,
    confidence: parsed.confidence,
    needsReview: parsed.needsReview || ambiguousMatches.length > 0,
    ambiguousMatches,
    notes: parsed.notes ?? '',
  };

  if (warnings.length > 0 && !proposal.notes) {
    proposal.notes = warnings.join('; ');
  }

  return { proposal, warnings };
}
