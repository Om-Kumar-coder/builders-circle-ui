const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running migration...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'prisma', 'migrations', 'add_session_tracking_and_weights.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.trim().substring(0, 50) + '...');
        await prisma.$executeRawUnsafe(statement.trim());
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    // If tables already exist, that's okay
    if (error.message.includes('already exists')) {
      console.log('ℹ️ Tables already exist, skipping...');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch(console.error);