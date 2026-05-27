import { z } from 'zod';

/**
 * Zod schemas matching the JSON contract in `prompt.ts`.
 *
 * These describe the *raw* shape the model is asked to produce. The result is
 * then run through `reconcile.ts` to drop redundant SIBLINGs, blank-name
 * normalization, etc. We validate here in `parse` mode so a malformed model
 * response surfaces as a clear field-level ZodError downstream.
 *
 * Limits mirror Section 8.1 of the prompt (max 50 persons).
 */

export const AI_PLAN_MAX_PERSONS = 50;

export const AiGenderSchema = z.enum(['MALE', 'FEMALE', 'UNKNOWN']);
export type AiGender = z.infer<typeof AiGenderSchema>;

export const AiGenderConfidenceSchema = z.enum([
  'high',
  'low',
  'inferred_from_role',
]);
export type AiGenderConfidence = z.infer<typeof AiGenderConfidenceSchema>;

export const AiRelationshipTypeSchema = z.enum([
  'SPOUSE',
  'PARENT_CHILD',
  'SIBLING',
]);
export type AiRelationshipType = z.infer<typeof AiRelationshipTypeSchema>;

export const AiPersonSchema = z.object({
  local_id: z.string().min(1),
  first_name_he: z.string().min(1),
  last_name_he: z.string().min(1),
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  gender: AiGenderSchema,
  gender_confidence: AiGenderConfidenceSchema,
  birth_year: z.number().int().optional(),
  death_year: z.number().int().optional(),
  is_deceased: z.boolean().optional(),
  notes: z.string().max(200).optional(),
});
export type AiPerson = z.infer<typeof AiPersonSchema>;

export const AiRelationshipSchema = z.object({
  type: AiRelationshipTypeSchema,
  from_local_id: z.string().min(1),
  to_local_id: z.string().min(1),
});
export type AiRelationship = z.infer<typeof AiRelationshipSchema>;

export const AiTreePlanSchema = z.object({
  summary: z.string(),
  persons: z.array(AiPersonSchema).max(AI_PLAN_MAX_PERSONS),
  relationships: z.array(AiRelationshipSchema),
  suggested_root_local_id: z.string(),
});
export type AiTreePlan = z.infer<typeof AiTreePlanSchema>;
