import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Test user credentials
  const testUsers = [
    {
      email: 'founder@test.com',
      password: 'founder123',
      name: 'Test Founder',
      role: 'founder'
    },
    {
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Test Admin',
      role: 'admin'
    },
    {
      email: 'user@test.com',
      password: 'user123',
      name: 'Test User',
      role: 'contributor'
    },
    {
      email: 'employee@test.com',
      password: 'employee123',
      name: 'Test Employee',
      role: 'employee'
    }
  ];

  // Create test users
  for (const userData of testUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (existingUser) {
      console.log(`👤 User ${userData.email} already exists, skipping...`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        profile: {
          create: {
            role: userData.role,
            status: 'active'
          }
        }
      },
      include: {
        profile: true
      }
    });

    console.log(`✅ Created ${userData.role}: ${userData.email} (password: ${userData.password})`);
  }

  // Create a test build cycle
  const existingCycle = await prisma.buildCycle.findFirst({
    where: { name: 'Test Cycle 1' }
  });

  if (!existingCycle) {
    const testCycle = await prisma.buildCycle.create({
      data: {
        name: 'Test Cycle 1',
        state: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        participantCount: 0
      }
    });

    console.log(`🔄 Created test build cycle: ${testCycle.name}`);
  } else {
    console.log('🔄 Test build cycle already exists, skipping...');
  }

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });