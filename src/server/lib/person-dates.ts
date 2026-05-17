import { deriveHebrewDateFields } from '@/features/persons/lib/hebrewDate';
import type { PersonInput, PersonPatch } from '@/features/family-tree/schemas/person.schema';

type LifeStatusWritable = {
  is_deceased?: boolean;
  death_date?: Date | null;
  death_date_hebrew?: string | null;
  death_year_hebrew?: string | null;
};

/**
 * Server invariant: a living person never carries death_date or Hebrew death fields.
 */
export function normalizeLifeStatusInput<T extends LifeStatusWritable>(data: T): T {
  if (data.is_deceased === false) {
    data.death_date = null;
    data.death_date_hebrew = null;
    data.death_year_hebrew = null;
  }
  return data;
}

function effectiveDates(
  patch: PersonPatch,
  existing: { birth_date: Date | null; death_date: Date | null; is_deceased: boolean },
) {
  const isDeceased = patch.is_deceased !== undefined ? patch.is_deceased : existing.is_deceased;
  let deathDate =
    patch.death_date !== undefined ? patch.death_date : existing.death_date;
  if (isDeceased === false) deathDate = null;

  return {
    birth_date: patch.birth_date !== undefined ? patch.birth_date : existing.birth_date,
    death_date: deathDate,
    is_deceased: isDeceased,
  };
}

/** Full create payload: normalize life status + derive all Hebrew columns. */
export function withHebrewDatesForCreate<T extends PersonInput>(data: T): T & ReturnType<typeof deriveHebrewDateFields> {
  const normalized = normalizeLifeStatusInput({ ...data });
  return { ...normalized, ...deriveHebrewDateFields(normalized) };
}

/**
 * Patch payload: recompute Hebrew only when birth/death/life-status change.
 * Merges with existing row for effective Gregorian values before deriving.
 */
export function withHebrewDatesForUpdate(
  patch: PersonPatch,
  existing: { birth_date: Date | null; death_date: Date | null; is_deceased: boolean },
): PersonPatch {
  const normalized = normalizeLifeStatusInput({ ...patch });
  const dateTouched =
    patch.birth_date !== undefined ||
    patch.death_date !== undefined ||
    patch.is_deceased !== undefined;

  if (!dateTouched) return normalized;

  const effective = effectiveDates(normalized, existing);
  normalizeLifeStatusInput(effective);
  return { ...normalized, ...deriveHebrewDateFields(effective) };
}

/** For REST POST when building from raw body fields. */
export function buildRestCreatePersonDates(input: {
  birth_date: Date | null;
  death_date: Date | null;
  is_deceased: boolean;
}) {
  const normalized = normalizeLifeStatusInput({ ...input });
  return deriveHebrewDateFields(normalized);
}

/** For REST PATCH when date/life fields may be present. */
export function buildRestPatchPersonDates(
  patch: {
    birth_date?: Date | null;
    death_date?: Date | null;
    is_deceased?: boolean;
  },
  existing: { birth_date: Date | null; death_date: Date | null; is_deceased: boolean },
): ReturnType<typeof deriveHebrewDateFields> | null {
  const dateTouched =
    patch.birth_date !== undefined ||
    patch.death_date !== undefined ||
    patch.is_deceased !== undefined;
  if (!dateTouched) return null;

  const isDeceased = patch.is_deceased ?? existing.is_deceased;
  const merged = normalizeLifeStatusInput({
    birth_date: patch.birth_date !== undefined ? patch.birth_date : existing.birth_date,
    death_date:
      patch.is_deceased === false
        ? null
        : patch.death_date !== undefined
          ? patch.death_date
          : existing.death_date,
    is_deceased: isDeceased,
  });
  return deriveHebrewDateFields(merged);
}
