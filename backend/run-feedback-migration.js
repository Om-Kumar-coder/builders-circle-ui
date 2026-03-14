const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Running feedback migration...');
    
    // Add feedback fields to activity_events if they don't exist
    try {
      await prisma.$executeRaw`
        ALTER TABLE activity_events ADD COLUMN feedbackComment TEXT;
      `;
      console.log('Added feedbackComment column');
    } catch (error) {
      console.log('feedbackComment column already exists or error:', error.message);
    }
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE activity_events ADD COLUMN feedbackAuthor TEXT;
      `;
      console.log('Added feedbackAuthor column');
    } catch (error) {
      console.log('feedbackAuthor column already exists or error:', error.message);
    }
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE activity_events ADD COLUMN feedbackTimestamp DATETIME;
      `;
      console.log('Added feedbackTimestamp column');
    } catch (error) {
      console.log('feedbackTimestamp column already exists or error:', error.message);
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();