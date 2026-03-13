import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production database setup...');

  // Create only essential admin user for production
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@buildercircle.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'System Admin';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log(`👤 Admin user ${adminEmail} already exists, skipping...`);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        profile: {
          create: {
            role: 'founder',
            status: 'active'
          }
        }
      },
      include: {
        profile: true
      }
    });

    console.log(`✅ Created admin user: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
  }

  console.log('🎉 Production database setup completed!');
  console.log('📝 Remember to change default admin password after first login');
}

main()
  .catch((e) => {
    console.error('❌ Error during setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });