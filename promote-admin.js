const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = process.argv[2];
  if (!userId) { console.error('Usage: node promote-admin.js <userId>'); process.exit(1); }
  
  const profile = await prisma.userProfile.update({
    where: { userId },
    data: { role: 'admin' }
  });
  console.log(`Promoted user ${userId} to admin. Role: ${profile.role}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
