/**
 * Quick layout checks: 2-spouse (unchanged pill) vs 3-spouse (overflow solo).
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/verify-multi-spouse-layout.ts
 */
import { buildBipartiteGraph } from '../src/features/family-tree/lib/buildBipartiteGraph';
import { layoutBipartiteGraph } from '../src/features/family-tree/lib/elkLayout';
import { buildPedigreeChildFlowEdges } from '../src/features/family-tree/lib/pedigreeChildEdges';
import type { PersonRow, RelationshipRow } from '../src/features/family-tree/lib/types';

function person(id: string, gender: 'MALE' | 'FEMALE'): PersonRow {
  return {
    id,
    first_name: id,
    last_name: null,
    gender,
    birth_date: null,
    death_date: null,
    is_deceased: false,
    profile_image: null,
  };
}

function spouse(a: string, b: string, id: string): RelationshipRow {
  return {
    id,
    relationship_type: 'SPOUSE',
    person1_id: a < b ? a : b,
    person2_id: a < b ? b : a,
    start_date: null,
    end_date: null,
  };
}

function parentChild(parent: string, child: string, id: string): RelationshipRow {
  return {
    id,
    relationship_type: 'PARENT_CHILD',
    person1_id: parent,
    person2_id: child,
    start_date: null,
    end_date: null,
  };
}

async function runCase(label: string, rels: RelationshipRow[], focal: string) {
  const ids = new Set<string>();
  for (const r of rels) {
    ids.add(r.person1_id);
    ids.add(r.person2_id);
  }
  const persons = [...ids].map((id) => person(id, id === 'yossi' ? 'MALE' : 'FEMALE'));

  const graph = buildBipartiteGraph(persons, rels, focal);
  const layout = await layoutBipartiteGraph(graph);
  const posById = new Map(layout.nodes.map((n) => [n.id, n]));
  const flowChildren = buildPedigreeChildFlowEdges(layout.edges, posById);

  console.log(`\n=== ${label} ===`);
  for (const n of layout.nodes.filter((x) => x.kind === 'union')) {
    console.log(
      `union ${n.id} layout_solo_parent_id=${n.union?.layout_solo_parent_id ?? '—'}`,
    );
  }
  for (const e of flowChildren) {
    const child = e.target;
    const src = e.source;
    console.log(
      `child ${child} <- ${src} variant=${e.data.variant} (graph union was ${layout.edges.find((x) => x.kind === 'child' && x.target === child)?.source})`,
    );
  }
}

async function main() {
  await runCase('2-spouse', [
    spouse('yossi', 'ilana', 'r_si'),
    spouse('yossi', 'aviva', 'r_sa'),
    parentChild('yossi', 'c1', 'r_p1'),
    parentChild('ilana', 'c1', 'r_p2'),
    parentChild('yossi', 'c2', 'r_p3'),
    parentChild('aviva', 'c2', 'r_p4'),
  ], 'yossi');

  await runCase('3-spouse', [
    spouse('yossi', 'ilana', 'r_si'),
    spouse('yossi', 'aviva', 'r_sa'),
    spouse('yossi', 'shula', 'r_ss'),
    parentChild('yossi', 'c1', 'r_p1'),
    parentChild('ilana', 'c1', 'r_p2'),
    parentChild('yossi', 'c2', 'r_p3'),
    parentChild('aviva', 'c2', 'r_p4'),
    parentChild('yossi', 'c3', 'r_p5'),
    parentChild('shula', 'c3', 'r_p6'),
  ], 'yossi');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
