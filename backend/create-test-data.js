const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🔄 Creating test data...');
    
    // Get the existing user
    const user = await prisma.user.findFirst({
      where: { email: 'admin@test.com' }
    });
    
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }
    
    console.log(`👤 Found user: ${user.email}`);
    
    // Update user profile to admin
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { role: 'admin' },
      create: {
        userId: user.id,
        role: 'admin',
        status: 'active'
      }
    });
    console.log('✅ Updated user to admin role');
    
    // Create a test cycle
    const existingCycle = await prisma.buildCycle.findFirst();
    let cycle;
    
    if (!existingCycle) {
      cycle = await prisma.buildCycle.create({
        data: {
          name: 'Test Build Cycle',
          description: 'A test cycle for debugging features',
          state: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          participantCount: 1
        }
      });
      console.log(`✅ Created test cycle: ${cycle.name}`);
    } else {
      cycle = existingCycle;
      console.log(`ℹ️ Using existing cycle: ${cycle.name}`);
    }
    
    // Create participation
    const existingParticipation = await prisma.cycleParticipation.findUnique({
      where: {
        userId_cycleId: {
          userId: user.id,
          cycleId: cycle.id
        }
      }
    });
    
    if (!existingParticipation) {
      await prisma.cycleParticipation.create({
        data: {
          userId: user.id,
          cycleId: cycle.id,
          optedIn: true,
          participationStatus: 'active',
          stallStage: 'active'
        }
      });
      console.log('✅ Created user participation in cycle');
    } else {
      console.log('ℹ️ User already participating in cycle');
    }
    
    // Create some test activities
    const existingActivities = await prisma.activityEvent.findMany({
      where: { userId: user.id, cycleId: cycle.id }
    });
    
    if (existingActivities.length === 0) {
      const testActivities = [
        {
          activityType: 'Feature Implementation',
          contributionType: 'code',
          proofLink: 'https://github.com/test/repo/pull/1',
          description: 'Implemented user authentication system',
          hoursLogged: 4.5,
          workSummary: 'Built JWT auth, login/signup forms, and session management',
          contributionWeight: 1.0
        },
        {
          activityType: 'API Documentation',
          contributionType: 'documentation',
          proofLink: 'https://github.com/test/repo/pull/2',
          description: 'Documented all API endpoints',
          hoursLogged: 2.0,
          workSummary: 'Created comprehensive API docs with examples',
          contributionWeight: 0.6
        },
        {
          activityType: 'Code Review',
          contributionType: 'review',
          proofLink: 'https://github.com/test/repo/pull/3',
          description: 'Reviewed security implementation',
          hoursLogged: 1.5,
          workSummary: 'Reviewed authentication and authorization code',
          contributionWeight: 0.5
        }
      ];
      
      for (const activity of testActivities) {
        await prisma.activityEvent.create({
          data: {
            userId: user.id,
            cycleId: cycle.id,
            ...activity,
            status: 'pending'
          }
        });
      }
      console.log(`✅ Created ${testActivities.length} test activities`);
    } else {
      console.log(`ℹ️ Found ${existingActivities.length} existing activities`);
    }
    
    console.log('✅ Test data creation completed!');
    console.log('\n📋 Summary:');
    console.log(`   User: ${user.email} (admin)`);
    console.log(`   Cycle: ${cycle.name} (${cycle.state})`);
    console.log(`   Activities: ${existingActivities.length > 0 ? existingActivities.length : 3} activities`);
    
  } catch (error) {
    console.error('❌ Failed to create test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();