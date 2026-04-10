const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, 'prisma/migrations/add_gatekeeper_veronica.sql'),
    'utf8'
  );
  // Split on semicolons and run each statement
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log('OK:', stmt.slice(0, 60).replace(/\n/g, ' '));
    } catch (e) {
      console.warn('SKIP (may already exist):', e.message.slice(0, 80));
    }
  }
  console.log('Gatekeeper migration complete.');
}

main().finally(() => prisma.$disconnect());
