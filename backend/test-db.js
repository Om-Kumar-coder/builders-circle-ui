const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test users
    const users = await prisma.user.findMany({
      include: { profile: true }
    });
    console.log(`📊 Found ${users.length} users:`);
    users.forEach(u => console.log(`  - ${u.email} (${u.profile?.role || 'no role'})`));
    
    // Test cycles
    const cycles = await prisma.buildCycle.findMany();
    console.log(`📊 Found ${cycles.length} cycles:`);
    cycles.forEach(c => console.log(`  - ${c.name} (${c.state})`));
    
    // Test activities
    const activities = await prisma.activityEvent.findMany();
    console.log(`📊 Found ${activities.length} activities`);
    
    // Test contribution weights
    const weights = await prisma.contributionWeight.findMany();
    console.log(`📊 Found ${weights.length} contribution weights:`);
    weights.forEach(w => console.log(`  - ${w.contributionType}: ${w.weight}x`));
    
    // Test sessions
    const sessions = await prisma.userActivitySession.findMany();
    console.log(`📊 Found ${sessions.length} user sessions`);
    
    console.log('✅ Database test completed successfully!');
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();