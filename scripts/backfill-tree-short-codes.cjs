/**
 * One-time backfill: assign a unique 4-digit shortCode to every tree that is missing one.
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   node scripts/backfill-tree-short-codes.cjs
 */

const { randomInt } = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function randomCode() {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

async function main() {
  const trees = await prisma.tree.findMany({
    select: { id: true, shortCode: true },
  });

  const missing = trees.filter((t) => !t.shortCode || t.shortCode.length !== 4);
  if (missing.length === 0) {
    console.log('All trees already have a shortCode. Nothing to do.');
    return;
  }

  const used = new Set(
    (await prisma.tree.findMany({ select: { shortCode: true } }))
      .map((t) => t.shortCode)
      .filter(Boolean),
  );

  for (const tree of missing) {
    let code;
    let attempts = 0;
    do {
      code = randomCode();
      attempts += 1;
      if (attempts > 500) {
        throw new Error(`Could not allocate shortCode for tree ${tree.id}`);
      }
    } while (used.has(code));
    used.add(code);
    await prisma.tree.update({
      where: { id: tree.id },
      data: { shortCode: code },
    });
    console.log(`Tree ${tree.id} → shortCode ${code}`);
  }

  console.log(`Done. Updated ${missing.length} tree(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
