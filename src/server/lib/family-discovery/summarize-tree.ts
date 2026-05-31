import type { Gender, RelationshipType } from '@prisma/client';

export interface TreePersonSummary {
  id: string;
  first_name_he: string | null;
  last_name_he: string | null;
  maiden_name: string | null;
  first_name: string;
  last_name: string | null;
  gender: Gender;
  birth_date: Date | null;
  death_date: Date | null;
  birth_place: string | null;
}

export interface TreeRelationshipSummary {
  id: string;
  relationship_type: RelationshipType;
  person1_id: string;
  person2_id: string;
}

export interface TreeSummaryInput {
  treeName: string;
  aboutText: string | null;
  persons: TreePersonSummary[];
  relationships: TreeRelationshipSummary[];
}

function hebrewFullName(p: TreePersonSummary): string {
  const first = (p.first_name_he ?? p.first_name).trim();
  const last = (p.last_name_he ?? p.last_name ?? '').trim();
  return [first, last].filter(Boolean).join(' ');
}

function genderHe(g: Gender): string {
  switch (g) {
    case 'MALE':
      return 'זכר';
    case 'FEMALE':
      return 'נקבה';
    default:
      return 'לא ידוע';
  }
}

function formatDate(d: Date | null): string {
  if (!d) return 'לא ידוע';
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (m === 1 && day === 1) return String(y);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function personById(
  persons: TreePersonSummary[],
): Map<string, TreePersonSummary> {
  return new Map(persons.map((p) => [p.id, p]));
}

function normalizeHebrewName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Normalized Hebrew full names for dedupe against existing tree members. */
export function collectExistingHebrewNames(persons: TreePersonSummary[]): Set<string> {
  const names = new Set<string>();
  for (const p of persons) {
    names.add(normalizeHebrewName(hebrewFullName(p)));
  }
  return names;
}

export function buildTreeSummaryBlock(input: TreeSummaryInput): string {
  const lookup = personById(input.persons);
  const lines: string[] = [
    '## עץ משפחה קיים',
    '',
    `שם העץ: ${input.treeName}`,
  ];

  if (input.aboutText?.trim()) {
    lines.push(`תיאור/קהילה: ${input.aboutText.trim()}`);
  }

  lines.push('', `### אנשים בעץ (${input.persons.length})`);
  lines.push('לכל אדם — שורה אחת:');

  for (const p of input.persons) {
    const maidenSuffix = p.maiden_name?.trim() ? ` (נעורים: ${p.maiden_name.trim()})` : '';
    lines.push(
      `- [id: ${p.id}] ${hebrewFullName(p)}${maidenSuffix} | מגדר: ${genderHe(p.gender)} | נולד: ${formatDate(p.birth_date)} | נפטר: ${formatDate(p.death_date)} | מקום לידה: ${p.birth_place?.trim() || '—'}`,
    );
  }

  const parentTypes: RelationshipType[] = ['PARENT_CHILD', 'ADOPTED_PARENT'];
  const parentEdges = input.relationships.filter((r) =>
    parentTypes.includes(r.relationship_type),
  );
  const spouseEdges = input.relationships.filter((r) => r.relationship_type === 'SPOUSE');
  const siblingEdges = input.relationships.filter((r) => r.relationship_type === 'SIBLING');

  lines.push('', `### קשרים (${input.relationships.length})`);

  for (const r of parentEdges) {
    const parent = lookup.get(r.person1_id);
    const child = lookup.get(r.person2_id);
    if (!parent || !child) continue;
    lines.push(
      `- ${hebrewFullName(parent)} → הורה של → ${hebrewFullName(child)}  (id: ${r.person1_id} → ${r.person2_id})`,
    );
  }

  for (const r of spouseEdges) {
    const a = lookup.get(r.person1_id);
    const b = lookup.get(r.person2_id);
    if (!a || !b) continue;
    lines.push(`- ${hebrewFullName(a)} ↔ בן/בת זוג ↔ ${hebrewFullName(b)}`);
  }

  for (const r of siblingEdges) {
    const a = lookup.get(r.person1_id);
    const b = lookup.get(r.person2_id);
    if (!a || !b) continue;
    lines.push(`- ${hebrewFullName(a)} ↔ אח/אחות ↔ ${hebrewFullName(b)}`);
  }

  const blockList = input.persons.map((p) => hebrewFullName(p)).join(', ');
  lines.push('', '### רשימת שמות לחסימה (אל תציע שוב)', blockList);

  return lines.join('\n');
}

export { hebrewFullName, normalizeHebrewName };
