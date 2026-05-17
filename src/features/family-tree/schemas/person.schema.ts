import { z } from 'zod';

import { parseGregorianDate } from '@/lib/dates/gregorian';

// Forms send dd/mm/yyyy; API may send yyyy-mm-dd. Coerce to UTC date-only Date.
const gregorianDate = z
  .union([z.string().min(1), z.date()])
  .transform((v) => {
    if (v instanceof Date) return v;
    return parseGregorianDate(v);
  })
  .refine(
    (d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()),
    { message: 'Invalid date' },
  );

const optionalGregorianDate = gregorianDate.optional().nullable();

export const GenderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);

// Shared field shape — re-used by both PersonInputSchema (create: is_deceased
// defaults to false) and PersonPatchSchema (update: is_deceased is optional,
// no default applied so an unrelated patch can't silently flip the flag).
const personFieldsShape = {
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().max(100).optional().nullable(),
  maiden_name: z.string().trim().max(100).optional().nullable(),
  first_name_he: z.string().trim().max(100).optional().nullable(),
  last_name_he: z.string().trim().max(100).optional().nullable(),
  gender: GenderSchema,
  birth_date: optionalGregorianDate,
  death_date: optionalGregorianDate,
  birth_place: z.string().trim().max(200).optional().nullable(),
  bio: z.string().trim().max(5000).optional().nullable(),
  profile_image: z.string().trim().max(500).optional().nullable(),
} as const;

// Cross-field rule: when the person is explicitly alive, death_date must be empty.
// We only flag when both fields are present in the parsed object — that way a
// partial patch that only touches an unrelated field never trips the refinement.
function refineLifeStatus(
  data: { is_deceased?: boolean; death_date?: Date | null },
  ctx: z.RefinementCtx,
) {
  if (data.is_deceased === false && data.death_date != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['death_date'],
      message: 'death_date must be empty when person is living',
    });
  }
}

/** Fields the UI can set when creating a person. `is_deceased` defaults to false. */
export const PersonInputSchema = z
  .object({
    ...personFieldsShape,
    is_deceased: z.boolean().default(false),
  })
  .superRefine(refineLifeStatus);
export type PersonInput = z.infer<typeof PersonInputSchema>;

/**
 * Update payloads are partial — any subset of fields. We rebuild the object
 * rather than `.partial()` the input schema so `is_deceased.default(false)`
 * is NOT re-applied when omitted (which would silently mark someone alive).
 */
export const PersonPatchSchema = z
  .object({
    ...personFieldsShape,
    is_deceased: z.boolean(),
  })
  .partial()
  .superRefine(refineLifeStatus);
export type PersonPatch = z.infer<typeof PersonPatchSchema>;

export const CuidSchema = z.string().min(1, 'id is required');
