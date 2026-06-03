import type { AddedRelativeDto } from '@/server/services/tree.service';
import {
  addChildInTree,
  addParentInTree,
  addSiblingInTree,
  addSpouseInTree,
} from '@/server/services/tree.service';

import { mergeNewPersonToPersonInput } from './person-input';
import type { AmbiguousMatch, FamilyMergeProposal, MergeNewPerson } from './schema';
import { topologicalSortNewPeople } from './topo-sort';

export interface ApplyMergeOpts {
  treeId: string;
  proposal: FamilyMergeProposal;
  resolvedAmbiguities: Record<string, string>;
  skipAmbiguous: boolean;
  existingIds: Set<string>;
}

export interface SkippedPerson {
  tempId: string;
  reason: string;
}

export interface ApplyMergeResult {
  applied: AddedRelativeDto[];
  skipped: SkippedPerson[];
  needsResolution: AmbiguousMatch[];
}

function isTempId(id: string): boolean {
  return /^new_\d+$/i.test(id);
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

function isAmbiguousPerson(
  p: MergeNewPerson,
  ambiguousTempIds: Set<string>,
  resolved: Record<string, string>,
): boolean {
  if (ambiguousTempIds.has(p.tempId) && !resolved[p.tempId]) return true;
  const anchor = anchorIdForPerson(p);
  if (anchor && ambiguousTempIds.has(anchor) && !resolved[anchor]) return true;
  return false;
}

export async function applyFamilyMergeProposal(
  opts: ApplyMergeOpts,
): Promise<ApplyMergeResult> {
  const { treeId, proposal, resolvedAmbiguities, skipAmbiguous, existingIds } = opts;
  const ambiguousTempIds = new Set(proposal.ambiguousMatches.map((a) => a.tempId));
  const idMap = new Map<string, string>();
  for (const [k, v] of Object.entries(resolvedAmbiguities)) {
    if (existingIds.has(v)) idMap.set(k, v);
  }

  const resolveId = (ref: string): string | null => {
    if (existingIds.has(ref)) return ref;
    if (idMap.has(ref)) return idMap.get(ref)!;
    if (isTempId(ref) && idMap.has(ref)) return idMap.get(ref)!;
    return null;
  };

  const skipped: SkippedPerson[] = [];
  const applied: AddedRelativeDto[] = [];
  const needsResolution: AmbiguousMatch[] = [];

  const clearPeople = proposal.newPeople.filter((p) => {
    if (isAmbiguousPerson(p, ambiguousTempIds, resolvedAmbiguities)) {
      if (skipAmbiguous) {
        skipped.push({ tempId: p.tempId, reason: 'ambiguous match unresolved' });
        return false;
      }
      needsResolution.push(
        proposal.ambiguousMatches.find((a) => a.tempId === p.tempId) ??
          proposal.ambiguousMatches[0],
      );
      return false;
    }
    return true;
  });

  if (needsResolution.length > 0 && !skipAmbiguous) {
    return { applied, skipped, needsResolution: proposal.ambiguousMatches };
  }

  const ordered = topologicalSortNewPeople(clearPeople);

  for (const person of ordered) {
    let anchor = anchorIdForPerson(person);
    if (!anchor) {
      skipped.push({ tempId: person.tempId, reason: 'missing anchor' });
      continue;
    }

    if (resolvedAmbiguities[person.tempId] && existingIds.has(resolvedAmbiguities[person.tempId])) {
      anchor = resolvedAmbiguities[person.tempId];
    }

    const resolvedAnchor = resolveId(anchor);
    if (!resolvedAnchor) {
      skipped.push({ tempId: person.tempId, reason: `unresolved anchor ${anchor}` });
      continue;
    }

    const input = mergeNewPersonToPersonInput(person);

    try {
      let result: AddedRelativeDto;
      switch (person.relation) {
        case 'child':
          result = await addChildInTree({
            treeId,
            parent1Id: resolvedAnchor,
            child: input,
          });
          break;
        case 'parent':
          result = await addParentInTree({
            treeId,
            childId: resolvedAnchor,
            parent: input,
          });
          break;
        case 'spouse':
          result = await addSpouseInTree({
            treeId,
            personId: resolvedAnchor,
            spouse: input,
            marriage_date: null,
          });
          break;
        case 'sibling':
          result = await addSiblingInTree({
            treeId,
            existingSiblingId: resolvedAnchor,
            sibling: input,
          });
          break;
        default:
          skipped.push({ tempId: person.tempId, reason: 'unknown relation' });
          continue;
      }
      idMap.set(person.tempId, result.person.id);
      applied.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'apply failed';
      skipped.push({ tempId: person.tempId, reason: message });
    }
  }

  return { applied, skipped, needsResolution: [] };
}
