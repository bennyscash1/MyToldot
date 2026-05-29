import { buildBipartiteGraph } from '../src/features/family-tree/lib/buildBipartiteGraph';
import { layoutBipartiteGraph } from '../src/features/family-tree/lib/elkLayout';

const persons = [
  { id: 'cmpr0971s0007ih7gvyawn05w', first_name: 'Adam', gender: 'MALE' as const, last_name: null, birth_date: null, death_date: null, is_deceased: false, profile_image: null },
  { id: 'cmpr09nt70009ih7gkpmsx6lw', first_name: 'Wife', gender: 'FEMALE' as const, last_name: null, birth_date: null, death_date: null, is_deceased: false, profile_image: null },
  { id: 'cmpr0a2lg000dih7g4604vszd', first_name: 'Child', gender: 'MALE' as const, last_name: null, birth_date: null, death_date: null, is_deceased: false, profile_image: null },
  { id: 'cmpr0lu200001ih6kcu708hnp', first_name: 'Wife1', gender: 'FEMALE' as const, last_name: null, birth_date: null, death_date: null, is_deceased: false, profile_image: null },
  { id: 'cmpr0lzx80005ih6kbnjcgguu', first_name: 'Wife2', gender: 'FEMALE' as const, last_name: null, birth_date: null, death_date: null, is_deceased: false, profile_image: null },
];
const rels = [
  { id: 'cmpr09nwr000bih7gte0onll0', relationship_type: 'SPOUSE' as const, person1_id: 'cmpr0971s0007ih7gvyawn05w', person2_id: 'cmpr09nt70009ih7gkpmsx6lw', start_date: null, end_date: null },
  { id: 'cmpr0a2q2000fih7grqlo4fi2', relationship_type: 'PARENT_CHILD' as const, person1_id: 'cmpr0971s0007ih7gvyawn05w', person2_id: 'cmpr0a2lg000dih7g4604vszd', start_date: null, end_date: null },
  { id: 'cmpr0a2q2000hih7g2s9lx12i', relationship_type: 'PARENT_CHILD' as const, person1_id: 'cmpr09nt70009ih7gkpmsx6lw', person2_id: 'cmpr0a2lg000dih7g4604vszd', start_date: null, end_date: null },
  { id: 'cmpr0lu5m0003ih6kotb77fhq', relationship_type: 'SPOUSE' as const, person1_id: 'cmpr0a2lg000dih7g4604vszd', person2_id: 'cmpr0lu200001ih6kcu708hnp', start_date: null, end_date: null },
  { id: 'cmpr0m01a0007ih6kk6u1unu6', relationship_type: 'SPOUSE' as const, person1_id: 'cmpr0a2lg000dih7g4604vszd', person2_id: 'cmpr0lzx80005ih6kbnjcgguu', start_date: null, end_date: null },
];

async function main() {
  const focal = 'cmpr0971s0007ih7gvyawn05w';
  const graph = buildBipartiteGraph(persons, rels, focal);
  const layout = await layoutBipartiteGraph(graph);
  const child = 'cmpr0a2lg000dih7g4604vszd';
  const childGen = layout.nodes.find((n) => n.id === child)?.gen;
  console.log('child gen', childGen);

  for (const gen of [...new Set(layout.nodes.map((n) => n.gen))].sort((a, b) => a - b)) {
    const row = layout.nodes.filter((n) => n.kind === 'person' && n.gen === gen).sort((a, b) => a.x - b.x);
    console.log(`\ngen ${gen} persons (L→R):`, row.map((n) => `${n.first_name}@${Math.round(n.x)}`).join(' | '));
    const unions = layout.nodes.filter((n) => n.kind === 'union' && n.gen === gen).sort((a, b) => a.x - b.x);
    for (const u of unions) {
      console.log(`  union ${u.id} x=${Math.round(u.x)} parents=${u.union?.parent_ids?.map((id) => persons.find((p) => p.id === id)?.first_name).join('+')}`);
    }
  }

  const row = layout.nodes.filter((n) => n.kind === 'person' && n.gen === childGen).sort((a, b) => a.x - b.x);
  const w1 = row.findIndex((n) => n.id === 'cmpr0lu200001ih6kcu708hnp');
  const c = row.findIndex((n) => n.id === child);
  const w2 = row.findIndex((n) => n.id === 'cmpr0lzx80005ih6kbnjcgguu');
  console.log(`\n2-pill sandwich: wife1=${w1} child=${c} wife2=${w2} ok=${w1 < c && c < w2}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
