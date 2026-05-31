import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import { parseGregorianDate } from '@/lib/dates/gregorian';

import type { FamilyMemberProposalDto } from '@/features/nudges/lib/family-discovery-types';

function isoToDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const trimmed = iso.trim();
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(Date.UTC(Number(trimmed), 0, 1));
  }
  return parseGregorianDate(trimmed);
}

export function proposalToPersonInput(
  proposal: Pick<
    FamilyMemberProposalDto,
    | 'firstNameHe'
    | 'lastNameHe'
    | 'firstNameEn'
    | 'lastNameEn'
    | 'gender'
    | 'birthDate'
    | 'deathDate'
    | 'birthPlace'
    | 'bio'
  >,
): PersonInput {
  const deathDate = isoToDate(proposal.deathDate);
  const birthDate = isoToDate(proposal.birthDate);
  const firstNameEn = proposal.firstNameEn?.trim() || proposal.firstNameHe.trim();
  const lastNameEn = proposal.lastNameEn?.trim() || proposal.lastNameHe.trim();

  return {
    first_name: firstNameEn,
    last_name: lastNameEn,
    first_name_he: proposal.firstNameHe.trim(),
    last_name_he: proposal.lastNameHe.trim(),
    gender: proposal.gender,
    birth_date: birthDate,
    death_date: deathDate,
    is_deceased: deathDate != null,
    birth_place: proposal.birthPlace?.trim() ?? null,
    bio: proposal.bio?.trim() ?? null,
  };
}
