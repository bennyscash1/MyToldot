import { z } from 'zod';

import { CuidSchema } from '@/features/family-tree/schemas/person.schema';

export const DiscoveryRelationshipTypeSchema = z.enum([
  'PARENT',
  'CHILD',
  'SPOUSE',
  'SIBLING',
]);

export const DiscoveryConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const DiscoveryGenderSchema = z.enum(['MALE', 'FEMALE']);

/** ISO date: YYYY or YYYY-MM-DD */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}(-\d{2}-\d{2})?$/, 'Invalid ISO date');

export const FamilyMemberProposalSchema = z.object({
  firstNameHe: z.string().trim().min(1),
  lastNameHe: z.string().trim().min(1),
  firstNameEn: z.string().trim().optional(),
  lastNameEn: z.string().trim().optional(),
  gender: DiscoveryGenderSchema,
  birthDate: IsoDateSchema.optional(),
  deathDate: IsoDateSchema.optional(),
  birthPlace: z.string().trim().optional(),
  bio: z.string().trim().max(500).optional(),
  relationship: z.object({
    relatedToPersonId: CuidSchema,
    type: DiscoveryRelationshipTypeSchema,
  }),
  sourceNote: z.string().trim().max(120).optional(),
  confidence: DiscoveryConfidenceSchema,
});

export const FamilyDiscoveryResponseSchema = z.object({
  proposals: z.array(FamilyMemberProposalSchema).max(8),
});

export const FamilyMemberProposalDtoSchema = FamilyMemberProposalSchema.extend({
  dedupeKey: z.string(),
  relatedToPersonNameHe: z.string(),
});

export const CommitDiscoveredMemberSchema = z.object({
  treeId: CuidSchema,
  proposal: FamilyMemberProposalSchema,
});

export type FamilyMemberProposal = z.infer<typeof FamilyMemberProposalSchema>;
export type FamilyMemberProposalDto = z.infer<typeof FamilyMemberProposalDtoSchema>;
export type DiscoveryRelationshipType = z.infer<typeof DiscoveryRelationshipTypeSchema>;
