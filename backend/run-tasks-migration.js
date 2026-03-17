/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'prisma/migrations/add_tasks_and_leave.sql'),
    'utf8'
  );

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      console.log('✅ Executed:', statement.substring(0, 60) + '...');
    } catch (err) {
      console.error('❌ Failed:', statement.substring(0, 60));
      console.error(err.message);
    }
  }

  await prisma.$disconnect();
  console.log('Migration complete.');
}

runMigration();
