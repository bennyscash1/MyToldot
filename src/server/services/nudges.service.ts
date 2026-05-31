import 'server-only';

import { prisma } from '@/lib/prisma';
import { buildBipartiteGraph } from '@/features/family-tree/lib/buildBipartiteGraph';
import type { PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';
import { seededShuffle } from '@/lib/nudges/seeded-shuffle';
import type { Nudge } from '@/features/nudges/lib/nudge-types';

const PRIORITY_BIRTH_DATE = 8;
const PRIORITY_PROFILE_IMAGE = 6;
const PRIORITY_DEATH_DATE = 5;
const PRIORITY_BIO = 4;

const MAX_NUDGES = 20;

function displayNameHe(p: {
  first_name: string;
  last_name: string | null;
  first_name_he: string | null;
  last_name_he: string | null;
}): string {
  const he = [p.first_name_he, p.last_name_he].filter(Boolean).join(' ').trim();
  if (he) return he;
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
}

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export async function computeNudgesForTree(treeId: string): Promise<Nudge[]> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { id: true, root_person_id: true },
  });
  if (!tree) return [];

  const [personsRaw, relationshipsRaw] = await Promise.all([
    prisma.person.findMany({
      where: { tree_id: treeId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        maiden_name: true,
        first_name_he: true,
        last_name_he: true,
        gender: true,
        birth_date: true,
        death_date: true,
        is_deceased: true,
        birth_place: true,
        bio: true,
        profile_image: true,
        profile_image_url: true,
      },
    }),
    prisma.relationship.findMany({
      where: { tree_id: treeId },
      select: {
        id: true,
        relationship_type: true,
        person1_id: true,
        person2_id: true,
        start_date: true,
        end_date: true,
      },
    }),
  ]);

  // Cast to client-side shapes; buildBipartiteGraph only reads id/gender/relationships
  // for layout, so omitted optional fields (Hebrew dates) are fine to skip.
  const persons = personsRaw as unknown as PersonRow[];
  const relationships = relationshipsRaw as unknown as RelationshipRow[];

  // Generation by person id (used to gate the bio nudge to ancestors).
  // If the tree has no root, leave the map empty and treat every person as
  // eligible — matches the spec's fallback.
  const genByPerson = new Map<string, number>();
  if (tree.root_person_id) {
    try {
      const graph = buildBipartiteGraph(persons, relationships, tree.root_person_id);
      for (const n of graph.nodes) {
        if (n.kind === 'person') genByPerson.set(n.id, n.gen);
      }
    } catch {
      // BFS failure (e.g. disconnected component) — fall back to no gen filter.
    }
  }

  const candidates: Nudge[] = [];

  for (const p of personsRaw) {
    const name = displayNameHe(p);
    const idBase = p.id;

    if (p.birth_date === null) {
      candidates.push({
        id: `${idBase}:birth_date`,
        type: 'birth_date',
        person_id: p.id,
        person_name_he: name,
        priority: PRIORITY_BIRTH_DATE,
      });
    }

    if (p.profile_image === null && p.profile_image_url === null) {
      candidates.push({
        id: `${idBase}:profile_image`,
        type: 'profile_image',
        person_id: p.id,
        person_name_he: name,
        priority: PRIORITY_PROFILE_IMAGE,
      });
    }

    if (p.is_deceased && p.death_date === null) {
      candidates.push({
        id: `${idBase}:death_date`,
        type: 'death_date',
        person_id: p.id,
        person_name_he: name,
        priority: PRIORITY_DEATH_DATE,
      });
    }

    const bioEmpty = !p.bio || p.bio.trim().length === 0;
    const gen = genByPerson.get(p.id) ?? 0;
    const bioGenOk = !tree.root_person_id || gen <= -1;
    if (bioEmpty && bioGenOk) {
      candidates.push({
        id: `${idBase}:bio`,
        type: 'bio',
        person_id: p.id,
        person_name_he: name,
        priority: PRIORITY_BIO,
      });
    }
  }

  // Group by priority, shuffle within each tier with a stable daily seed,
  // then concatenate DESC by priority.
  const byPriority = new Map<number, Nudge[]>();
  for (const n of candidates) {
    const arr = byPriority.get(n.priority) ?? [];
    arr.push(n);
    byPriority.set(n.priority, arr);
  }

  const seedBase = `${todayYyyymmdd()}${treeId}`;
  const ordered: Nudge[] = [];
  for (const priority of [...byPriority.keys()].sort((a, b) => b - a)) {
    const bucket = byPriority.get(priority) ?? [];
    ordered.push(...seededShuffle(bucket, `${seedBase}:${priority}`));
  }

  return ordered.slice(0, MAX_NUDGES);
}
