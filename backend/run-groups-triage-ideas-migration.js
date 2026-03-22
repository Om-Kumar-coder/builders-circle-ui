const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running groups/triage/ideas migration...');

    const sqlPath = path.join(__dirname, 'prisma', 'migrations', 'add_groups_triage_ideas.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 60) + '...');
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (err) {
        if (
          err.message.includes('already exists') ||
          err.message.includes('duplicate column') ||
          err.message.includes('SQLITE_ERROR: table') ||
          err.message.includes('no such column') // column already added
        ) {
          console.log('  ⚠️  Already applied, skipping.');
        } else {
          throw err;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch(console.error);
