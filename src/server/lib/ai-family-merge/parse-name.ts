/** Split a Hebrew/Latin full name into first + last (last token = family name). */
export function splitFullName(name: string): { firstNameHe: string; lastNameHe: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstNameHe: 'לא ידוע', lastNameHe: 'לא ידוע' };
  }
  if (parts.length === 1) {
    return { firstNameHe: parts[0], lastNameHe: 'לא ידוע' };
  }
  return {
    firstNameHe: parts.slice(0, -1).join(' '),
    lastNameHe: parts[parts.length - 1],
  };
}
