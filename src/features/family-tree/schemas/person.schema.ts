import { z } from 'zod';

// The form sends dates as ISO strings (`<input type="date">` value).
// We coerce to Date here, but preserve "undefined" for missing values — an
// omitted date must stay omitted, not become `new Date(undefined)` → Invalid.
const isoDate = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid date' });

const optionalIsoDate = isoDate.optional().nullable();

export const GenderSchema = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']);

/** Fields the UI can set when creating OR editing a person. */
export const PersonInputSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().max(100).optional().nullable(),
  maiden_name: z.string().trim().max(100).optional().nullable(),
  first_name_he: z.string().trim().max(100).optional().nullable(),
  last_name_he: z.string().trim().max(100).optional().nullable(),
  gender: GenderSchema,
  birth_date: optionalIsoDate,
  death_date: optionalIsoDate,
  birth_place: z.string().trim().max(200).optional().nullable(),
  bio: z.string().trim().max(5000).optional().nullable(),
  profile_image: z.string().trim().max(500).optional().nullable(),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

/** Update payloads are partial — any subset of fields. */
export const PersonPatchSchema = PersonInputSchema.partial();
export type PersonPatch = z.infer<typeof PersonPatchSchema>;

export const CuidSchema = z.string().min(1, 'id is required');
