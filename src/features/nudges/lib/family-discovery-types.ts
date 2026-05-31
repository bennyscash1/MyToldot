/** Client-side mirror of server FamilyMemberProposalDto (no server imports). */
export type DiscoveryConfidence = 'high' | 'medium' | 'low';

export type DiscoveryRelationshipType = 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING';

export interface FamilyMemberProposalDto {
  firstNameHe: string;
  lastNameHe: string;
  firstNameEn?: string;
  lastNameEn?: string;
  gender: 'MALE' | 'FEMALE';
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  bio?: string;
  relationship: {
    relatedToPersonId: string;
    type: DiscoveryRelationshipType;
  };
  sourceNote?: string;
  confidence: DiscoveryConfidence;
  dedupeKey: string;
  relatedToPersonNameHe: string;
}

export function proposalDisplayName(proposal: FamilyMemberProposalDto): string {
  return `${proposal.firstNameHe} ${proposal.lastNameHe}`.trim();
}
