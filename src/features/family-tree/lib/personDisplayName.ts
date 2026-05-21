import type { PersonRow } from './types';

export function fullNameFromPerson(person: PersonRow): string {
  const he = [person.first_name_he, person.last_name_he].filter(Boolean).join(' ').trim();
  if (he) return he;
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}
