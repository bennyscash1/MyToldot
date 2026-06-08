import { buildBipartiteGraph } from '@/features/family-tree/lib/buildBipartiteGraph';
import type { PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';

import type { RelationToHead, TreeSummary, TreeSummaryPerson } from './types';

const COUPLE_TYPES = new Set(['SPOUSE', 'ENGAGED', 'DIVORCED']);

/**
 * Hebrew-preferred full name, matching the per-field fallback used on the tree
 * canvas (first_name_he ?? first_name, last_name_he ?? last_name).
 */
export function personDisplayName(p: PersonRow): string {
  return [p.first_name_he ?? p.first_name, p.last_name_he ?? p.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
}

/** Parse a possibly-string/Date birth date into epoch ms, or null. */
function birthMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Resolve the family head per the agreed fallback chain:
 *   root_person_id (if present in the tree) -> oldest person by birth_date -> first person.
 * The viewer's linked person is intentionally NOT used: the PDF is a shared
 * family artifact, not viewer-personalised.
 */
export function resolveHeadId(
  persons: PersonRow[],
  rootPersonId: string | null,
): string | null {
  if (persons.length === 0) return null;

  if (rootPersonId && persons.some((p) => p.id === rootPersonId)) {
    return rootPersonId;
  }

  let oldest: { id: string; ms: number } | null = null;
  for (const p of persons) {
    const ms = birthMs(p.birth_date);
    if (ms == null) continue;
    if (!oldest || ms < oldest.ms) oldest = { id: p.id, ms };
  }
  if (oldest) return oldest.id;

  return persons[0]?.id ?? null;
}

/** Build the set of the head's spouse/engaged/divorced partner ids. */
export function headSpouseIds(headId: string, relationships: RelationshipRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of relationships) {
    if (!COUPLE_TYPES.has(r.relationship_type)) continue;
    if (r.person1_id === headId) out.add(r.person2_id);
    else if (r.person2_id === headId) out.add(r.person1_id);
  }
  return out;
}

function relToHead(
  personId: string,
  headId: string,
  gen: number,
  spouseIds: Set<string>,
): RelationToHead {
  if (personId === headId) return 'head';
  if (spouseIds.has(personId)) return 'spouse';
  if (gen < 0) return 'ancestor';
  if (gen > 0) return 'descendant';
  return 'other';
}

/**
 * Build the compact summary fed to the AI planner. The only family data the
 * planner ever sees is this object — names, generation, relation, and whether
 * a bio/photo exists. Generation is computed with the same BFS the canvas uses
 * ({@link buildBipartiteGraph}), seeded from the resolved head.
 */
export function buildTreeSummary(
  persons: PersonRow[],
  relationships: RelationshipRow[],
  headId: string | null,
): TreeSummary {
  if (!headId || persons.length === 0) {
    return { headId, familySize: persons.length, persons: [] };
  }

  const genById = new Map<string, number>();
  try {
    const graph = buildBipartiteGraph(persons, relationships, headId);
    for (const node of graph.nodes) {
      if (node.kind === 'person') genById.set(node.id, node.gen);
    }
  } catch {
    // BFS failure — leave generations at 0 (planner still gets names + relations).
  }

  const spouseIds = headSpouseIds(headId, relationships);

  const summaryPersons: TreeSummaryPerson[] = persons.map((p) => {
    const gen = genById.get(p.id) ?? 0;
    return {
      id: p.id,
      name: personDisplayName(p),
      gen,
      relToHead: relToHead(p.id, headId, gen, spouseIds),
      hasBio: Boolean(p.bio?.trim()),
      hasPhoto: Boolean(p.profile_image?.trim() || p.profile_image_url?.trim()),
    };
  });

  return { headId, familySize: persons.length, persons: summaryPersons };
}
