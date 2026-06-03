import { z } from 'zod';

import { CuidSchema } from '@/features/family-tree/schemas/person.schema';

export const MERGE_MAX_NEW_PEOPLE = 30;
export const MERGE_MAX_EXISTING_FAMILY = 200;

export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}(-\d{2}-\d{2})?$/, 'Invalid ISO date')
  .optional()
  .nullable();

export const MergeConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const MergeNewPersonRelationSchema = z.enum([
  'child',
  'parent',
  'spouse',
  'sibling',
]);

export const ExistingFamilyMemberSchema = z.object({
  id: CuidSchema,
  name: z.string().min(1),
  role: z.string().optional().nullable(),
  parentId: CuidSchema.optional().nullable(),
  spouseId: CuidSchema.optional().nullable(),
  birthDate: IsoDateSchema,
});

export const MergeMatchedToSchema = z
  .object({
    id: CuidSchema,
    name: z.string().min(1),
  })
  .nullable()
  .default(null);

export const MergeNewPersonSchema = z.object({
  tempId: z.string().min(1).regex(/^new_\d+$/i, 'tempId must look like new_1'),
  name: z.string().trim().min(1),
  birthDate: IsoDateSchema,
  deathDate: IsoDateSchema,
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional().default('UNKNOWN'),
  relation: MergeNewPersonRelationSchema,
  parentId: z.string().optional().nullable(),
  childOf: z.string().optional().nullable(),
  spouseId: z.string().optional().nullable(),
  siblingOf: z.string().optional().nullable(),
});

export const AmbiguousMatchSchema = z.object({
  tempId: z.string().min(1),
  candidateIds: z.array(CuidSchema).min(2),
  reason: z.string().min(1),
});

export const FamilyMergeProposalSchema = z.object({
  matchedTo: MergeMatchedToSchema,
  newPeople: z.array(MergeNewPersonSchema).max(MERGE_MAX_NEW_PEOPLE),
  confidence: MergeConfidenceSchema,
  needsReview: z.boolean(),
  ambiguousMatches: z.array(AmbiguousMatchSchema).default([]),
  notes: z.string().default(''),
});

export const ResolvedAmbiguitiesSchema = z.record(z.string(), CuidSchema);

export const CommitFamilyMergeSchema = z.object({
  treeId: CuidSchema,
  proposal: FamilyMergeProposalSchema,
  resolvedAmbiguities: ResolvedAmbiguitiesSchema.optional().default({}),
  skipAmbiguous: z.boolean().optional().default(false),
});

export type ExistingFamilyMember = z.infer<typeof ExistingFamilyMemberSchema>;
export type MergeNewPerson = z.infer<typeof MergeNewPersonSchema>;
export type AmbiguousMatch = z.infer<typeof AmbiguousMatchSchema>;
export type FamilyMergeProposal = z.infer<typeof FamilyMergeProposalSchema>;
