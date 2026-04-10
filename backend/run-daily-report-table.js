const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check if tables exist by trying to count them
  try {
    const gr = await prisma.gatekeeperReview.count();
    console.log('✅ gatekeeper_reviews table exists, rows:', gr);
  } catch (e) {
    console.error('❌ gatekeeper_reviews missing:', e.message);
  }

  try {
    const dr = await prisma.dailyReport.count();
    console.log('✅ daily_reports table exists, rows:', dr);
  } catch (e) {
    console.error('❌ daily_reports missing:', e.message);
    // Try to create it via raw SQL
    console.log('Attempting to create daily_reports table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "daily_reports" (
        "id" TEXT NOT NULL,
        "reportDate" TIMESTAMP(3) NOT NULL,
        "newSignups" INTEGER NOT NULL DEFAULT 0,
        "approvedUsers" INTEGER NOT NULL DEFAULT 0,
        "rejectedUsers" INTEGER NOT NULL DEFAULT 0,
        "totalSubmissions" INTEGER NOT NULL DEFAULT 0,
        "approvedSubmissions" INTEGER NOT NULL DEFAULT 0,
        "rejectedSubmissions" INTEGER NOT NULL DEFAULT 0,
        "pendingSubmissions" INTEGER NOT NULL DEFAULT 0,
        "activeContributors" INTEGER NOT NULL DEFAULT 0,
        "inactiveContributors" INTEGER NOT NULL DEFAULT 0,
        "openCycles" INTEGER NOT NULL DEFAULT 0,
        "pendingReviews" INTEGER NOT NULL DEFAULT 0,
        "flaggedItems" INTEGER NOT NULL DEFAULT 0,
        "metadata" TEXT,
        "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "daily_reports_reportDate_key" ON "daily_reports"("reportDate")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "daily_reports_reportDate_idx" ON "daily_reports"("reportDate")
    `);
    console.log('✅ daily_reports table created');
  }

  try {
    const gr2 = await prisma.gatekeeperReview.count();
    console.log('✅ gatekeeper_reviews confirmed, rows:', gr2);
  } catch (e) {
    console.log('Attempting to create gatekeeper_reviews table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "gatekeeper_reviews" (
        "id" TEXT NOT NULL,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "queue" TEXT NOT NULL DEFAULT 'new_users',
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "veronicaScore" DOUBLE PRECISION,
        "veronicaFlags" TEXT,
        "veronicaNotes" TEXT,
        "reviewedBy" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "gatekeeper_reviews_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "gatekeeper_reviews_entityType_entityId_idx" ON "gatekeeper_reviews"("entityType","entityId")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "gatekeeper_reviews_queue_status_idx" ON "gatekeeper_reviews"("queue","status")`);
    console.log('✅ gatekeeper_reviews table created');
  }

  // Now try generating a report
  console.log('\nAttempting to generate a test report...');
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const [newSignups, totalSubmissions, openCycles] = await Promise.all([
      prisma.triageSubmission.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.activityEvent.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.buildCycle.count({ where: { state: { in: ['active','planned'] } } }),
    ]);
    const report = await prisma.dailyReport.upsert({
      where: { reportDate: today },
      create: { reportDate: today, newSignups, totalSubmissions, openCycles },
      update: { newSignups, totalSubmissions, openCycles, generatedAt: new Date() },
    });
    console.log('✅ Report generated:', report.id, 'date:', report.reportDate);
  } catch (e) {
    console.error('❌ Report generation failed:', e.message);
  }
}

main().finally(() => prisma.$disconnect());
