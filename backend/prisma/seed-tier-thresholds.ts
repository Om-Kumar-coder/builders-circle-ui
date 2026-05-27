/**
 * Seed script — Default tier thresholds for Phase 2b.
 *
 * Idempotent — safe to run multiple times (uses upsert).
 *
 * Usage:
 *   npx ts-node prisma/seed-tier-thresholds.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_THRESHOLDS = [
  {
    tier: 'founder',
    minScore: 80,
    minCycles: 0,
    description: 'Full platform access & governance rights (admin-assigned only)',
    isActive: true,
  },
  {
    tier: 'core',
    minScore: 60,
    minCycles: 3,
    description: 'Significant ownership stake & voting weight',
    isActive: true,
  },
  {
    tier: 'contributor',
    minScore: 30,
    minCycles: 0,
    description: 'Active participant earning ownership',
    isActive: true,
  },
  {
    tier: 'employee',
    minScore: 0,
    minCycles: 0,
    description: 'Salaried team member (role-based, not score-based)',
    isActive: true,
  },
  {
    tier: 'observer',
    minScore: 0,
    minCycles: 0,
    description: 'Read-only access (default for new/inactive users)',
    isActive: true,
  },
];

async function main() {
  console.log('Seeding tier thresholds...');

  for (const t of DEFAULT_THRESHOLDS) {
    await prisma.tierThreshold.upsert({
      where: { tier: t.tier },
      update: {
        minScore: t.minScore,
        minCycles: t.minCycles,
        description: t.description,
        isActive: t.isActive,
      },
      create: t,
    });
    console.log(`  ${t.tier}: minScore=${t.minScore}, minCycles=${t.minCycles}`);
  }

  console.log('Tier thresholds seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
