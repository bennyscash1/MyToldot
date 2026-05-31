import { proposalToPersonInput } from '@/features/family-tree/lib/proposal-to-person';

import type { FamilyMemberProposal, FamilyMemberProposalDto } from './schema';
import { hebrewFullName, normalizeHebrewName, type TreePersonSummary } from './summarize-tree';

export { proposalToPersonInput };

export function proposalDedupeKey(proposal: FamilyMemberProposal): string {
  const name = normalizeHebrewName(`${proposal.firstNameHe} ${proposal.lastNameHe}`);
  return `${name}|${proposal.relationship.relatedToPersonId}|${proposal.relationship.type}`;
}

const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

export function enrichAndFilterProposals(
  proposals: FamilyMemberProposal[],
  persons: TreePersonSummary[],
  existingNames: Set<string>,
): FamilyMemberProposalDto[] {
  const personMap = new Map(persons.map((p) => [p.id, p]));
  const seenKeys = new Set<string>();
  const enriched: FamilyMemberProposalDto[] = [];

  const sorted = [...proposals].sort(
    (a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence],
  );

  for (const proposal of sorted) {
    const anchor = personMap.get(proposal.relationship.relatedToPersonId);
    if (!anchor) continue;

    const normalizedName = normalizeHebrewName(
      `${proposal.firstNameHe} ${proposal.lastNameHe}`,
    );
    if (existingNames.has(normalizedName)) continue;

    const dedupeKey = proposalDedupeKey(proposal);
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    enriched.push({
      ...proposal,
      dedupeKey,
      relatedToPersonNameHe: hebrewFullName(anchor),
    });
  }

  return enriched;
}
