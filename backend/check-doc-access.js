const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const grants = await p.documentAccess.findMany({
    include: {
      user: { select: { email: true } },
      document: { select: { title: true } }
    }
  });
  console.log('Total grants:', grants.length);
  console.log(JSON.stringify(grants, null, 2));

  const docs = await p.document.findMany({ select: { id: true, title: true, isActive: true } });
  console.log('\nDocuments:', JSON.stringify(docs, null, 2));
}

main().finally(() => p.$disconnect());
