import { PrismaClient } from '@prisma/client';

const p = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

const trees = await p.$queryRawUnsafe(
  `SELECT id, short_code FROM trees WHERE short_code = '10079'`,
);
console.log('trees', trees);
const treeId = trees[0]?.id;
if (!treeId) {
  await p.$disconnect();
  process.exit(0);
}

const persons = await p.$queryRawUnsafe(
  `SELECT id, first_name_he, first_name, last_name_he, gender FROM persons WHERE tree_id = '${treeId}' ORDER BY created_at`,
);
console.log('persons', JSON.stringify(persons, null, 2));

const rels = await p.$queryRawUnsafe(
  `SELECT id, relationship_type, person1_id, person2_id FROM relationships WHERE tree_id = '${treeId}' ORDER BY created_at`,
);
console.log('relationships', JSON.stringify(rels, null, 2));

await p.$disconnect();
