/**
 * Run the ownership economy engine migration.
 * Safe to run on production — additive only (no drops, no renames).
 *
 * Usage: node run-economy-engine-migration.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'prisma/migrations/add_ownership_economy_engine.sql'),
    'utf8'
  );

  console.log('Running ownership economy engine migration...');
  await prisma.$executeRawUnsafe(sql);
  console.log('Migration complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
