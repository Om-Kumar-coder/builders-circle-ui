const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_WEIGHTS = {
  code: 1.0,
  documentation: 0.6,
  review: 0.5,
  hours_logged: 0.4,
  research: 0.5,
  meeting: 0.2,
  task_completion: 0.8,
};

async function initializeWeights() {
  try {
    console.log('🔄 Initializing contribution weights...');
    
    for (const [type, weight] of Object.entries(DEFAULT_WEIGHTS)) {
      const existing = await prisma.contributionWeight.findUnique({
        where: { contributionType: type },
      });

      if (!existing) {
        await prisma.contributionWeight.create({
          data: {
            contributionType: type,
            weight,
            description: `Default weight for ${type} contributions`,
          },
        });
        console.log(`✅ Created weight for ${type}: ${weight}x`);
      } else {
        console.log(`ℹ️ Weight for ${type} already exists: ${existing.weight}x`);
      }
    }
    
    console.log('✅ Contribution weights initialized!');
  } catch (error) {
    console.error('❌ Failed to initialize weights:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeWeights();