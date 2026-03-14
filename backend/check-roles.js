// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, profile: { select: { role: true, userId: true } } }
  });
  users.forEach(u => console.log(u.email, '->', u.profile ? u.profile.role : 'NO PROFILE'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
