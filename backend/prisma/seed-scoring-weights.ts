/**
 * Seed script — default scoring weights for Phase 2a
 *
 * Usage: npx ts-node backend/prisma/seed-scoring-weights.ts
 *        or include in the main seed.ts
 *
 * Inserts the 6 default ScoringWeight rows used by the Application Scoring Engine.
 * Idempotent — skips existing rows on conflict.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_WEIGHTS = [
  {
    weightKey: 'intent',
    weight: 1.0,
    label: 'Intent Type',
    description: 'Importance of the applicant\'s intent type (join, collaborate, invest, propose, other)',
  },
  {
    weightKey: 'capital',
    weight: 0.5,
    label: 'Capital Commitment',
    description: 'Importance of the capital range the applicant is committing',
  },
  {
    weightKey: 'execution',
    weight: 2.0,
    label: 'Execution Track Record',
    description: 'Importance of prior execution proof (URL + outcome text)',
  },
  {
    weightKey: 'vp',
    weight: 1.5,
    label: 'Value Proposition',
    description: 'Importance of the value proposition quality (length-based)',
  },
  {
    weightKey: 'availability',
    weight: 0.8,
    label: 'Time Availability',
    description: 'Importance of the applicant\'s time commitment (full-time, part-time)',
  },
  {
    weightKey: 'veronica',
    weight: 1.2,
    label: 'Veronica AI Score',
    description: 'Importance of the Veronica AI gatekeeper scan score',
  },
];

async function seedScoringWeights() {
  console.log('[Seed] Seeding default scoring weights...');

  for (const w of DEFAULT_WEIGHTS) {
    await prisma.scoringWeight.upsert({
      where: { weightKey: w.weightKey },
      update: {
        weight: w.weight,
        label: w.label,
        description: w.description,
        isActive: true,
      },
      create: {
        weightKey: w.weightKey,
        weight: w.weight,
        label: w.label,
        description: w.description,
        isActive: true,
      },
    });
    console.log(`  ✓ ${w.weightKey} = ${w.weight}`);
  }

  console.log('[Seed] Scoring weights seeded successfully.');
}

seedScoringWeights()
  .catch((err) => {
    console.error('[Seed] Failed to seed scoring weights:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
