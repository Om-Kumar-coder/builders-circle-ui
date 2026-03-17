import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const testUsers = [
    { email: 'founder@test.com', password: 'founder123', name: 'Test Founder', role: 'founder' },
    { email: 'admin@test.com',   password: 'admin123',   name: 'Test Admin',   role: 'admin' },
    { email: 'user@test.com',    password: 'user123',    name: 'Test User',    role: 'contributor' },
    { email: 'employee@test.com',password: 'employee123',name: 'Test Employee',role: 'employee' },
  ];

  for (const userData of testUsers) {
    const existing = await prisma.user.findUnique({ where: { email: userData.email } });

    if (existing) {
      await prisma.user.update({
        where: { email: userData.email },
        data: {
          emailVerified: true,
          onboardingCompleted: true,
          onboardingStep: 99,
          twoFactorEnabled: false,
        },
      });
      console.log(`👤 Updated ${userData.email} (already existed)`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        emailVerified: true,
        onboardingCompleted: true,
        onboardingStep: 99,
        twoFactorEnabled: false,
        profile: {
          create: { role: userData.role, status: 'active' },
        },
      },
    });

    console.log(`✅ Created ${userData.role}: ${userData.email} / ${userData.password}`);
  }

  const existingCycle = await prisma.buildCycle.findFirst({ where: { name: 'Test Cycle 1' } });

  if (!existingCycle) {
    await prisma.buildCycle.create({
      data: {
        name: 'Test Cycle 1',
        state: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        participantCount: 0,
      },
    });
    console.log('🔄 Created test build cycle');
  } else {
    console.log('🔄 Test build cycle already exists, skipping...');
  }

  console.log('\n🎉 Seeding complete!');
  console.log('  founder@test.com  / founder123');
  console.log('  admin@test.com    / admin123');
  console.log('  user@test.com     / user123');
  console.log('  employee@test.com / employee123');
}

main()
  .catch((e) => { console.error('❌ Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
