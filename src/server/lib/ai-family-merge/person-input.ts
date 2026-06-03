import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import { parseGregorianDate } from '@/lib/dates/gregorian';

import { splitFullName } from './parse-name';
import type { MergeNewPerson } from './schema';

function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(Date.UTC(Number(trimmed), 0, 1));
  }
  return parseGregorianDate(trimmed);
}

export function mergeNewPersonToPersonInput(person: MergeNewPerson): PersonInput {
  const { firstNameHe, lastNameHe } = splitFullName(person.name);
  const deathDate = isoToDate(person.deathDate);
  const birthDate = isoToDate(person.birthDate);
  const gender =
    person.gender === 'MALE' || person.gender === 'FEMALE' ? person.gender : 'UNKNOWN';

  return {
    first_name: firstNameHe,
    last_name: lastNameHe,
    first_name_he: firstNameHe,
    last_name_he: lastNameHe,
    gender,
    birth_date: birthDate,
    death_date: deathDate,
    is_deceased: deathDate != null,
    birth_place: null,
    bio: null,
  };
}
