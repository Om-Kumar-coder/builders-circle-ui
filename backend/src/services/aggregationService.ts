/**
 * Aggregation Service
 * Computes total system contribution score per cycle and exposes
 * helpers for the normalization engine.
 *
 * ADDITIVE — does not touch existing tables or fields.
 */

import { prisma } from '../config/database';

/**
 * Returns the sum of all ContributionScore.score values for a given cycle.
 * Falls back to 0 safely if no scores exist yet.
 */
export async function getTotalCycleScore(cycleId: string): Promise<number> {
  const result = await prisma.contributionScore.aggregate({
    where: { cycleId },
    _sum: { score: true },
  });
  return result._sum.score ?? 0;
}

/**
 * Returns the active SystemPool config, or sensible defaults if none exists.
 */
export async function getSystemPool() {
  const pool = await prisma.systemPool.findFirst({ where: { isActive: true } });
  return pool ?? {
    totalValue: 0,
    contributorPoolPct: 0.4,
    founderPoolPct: 0.5,
    investorPoolPct: 0.1,
    decayRate: 0.01,
  };
}

/**
 * Returns all ContributionScore rows for a cycle, sorted descending.
 */
export async function getCycleScores(cycleId: string) {
  return prisma.contributionScore.findMany({
    where: { cycleId },
    orderBy: { score: 'desc' },
  });
}
