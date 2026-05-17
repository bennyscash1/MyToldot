/**
 * Recompute Hebrew date columns from existing Gregorian dates.
 *
 * Usage (from repo root):
 *   npm run backfill:hebrew-dates
 *
 * Idempotent — overwrites Hebrew columns for every person with a birth_date
 * and/or a death_date when deceased (fixes rows previously stored with wrong
 * conversion).
 */

import { PrismaClient } from '@prisma/client';
import { deriveHebrewDateFields } from '../src/features/persons/lib/hebrewDate';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function main() {
  const candidates = await prisma.person.findMany({
    where: {
      OR: [
        { birth_date: { not: null } },
        {
          AND: [
            { death_date: { not: null } },
            { is_deceased: true },
          ],
        },
      ],
    },
    select: {
      id: true,
      birth_date: true,
      death_date: true,
      is_deceased: true,
    },
  });

  if (candidates.length === 0) {
    console.log('No persons need Hebrew date backfill.');
    return;
  }

  console.log(`Recomputing Hebrew dates for ${candidates.length} person(s)...`);

  let updated = 0;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (person) => {
        const hebrew = deriveHebrewDateFields({
          birth_date: person.birth_date,
          death_date: person.death_date,
          is_deceased: person.is_deceased,
        });
        await prisma.person.update({
          where: { id: person.id },
          data: hebrew,
        });
        updated += 1;
      }),
    );
    console.log(`  ${Math.min(i + BATCH_SIZE, candidates.length)} / ${candidates.length}`);
  }

  console.log(`Done. Updated ${updated} person(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
