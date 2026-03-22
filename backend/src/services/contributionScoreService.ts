/**
 * Contribution Score Service
 * Converts verified ActivityEvents into numeric contribution scores using:
 *   scoreContribution = contributionWeight × hoursFactor × timeDecay
 * where timeDecay = e^(-decayRate × daysSinceActivity)
 *
 * All logic is ADDITIVE — no existing fields, tables, or APIs are modified.
 */

import { prisma } from '../config/database';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Exponential time-decay factor. */
function timeDecay(createdAt: Date, decayRate: number): number {
  const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-decayRate * daysSince);
}

/** Hours factor: log-scaled so diminishing returns kick in above 4 h. */
function hoursFactor(hoursLogged: number | null): number {
  if (!hoursLogged || hoursLogged <= 0) return 1.0;
  return 1 + Math.log(1 + hoursLogged) / Math.log(5); // ~1.0 at 0 h, ~2.0 at 4 h
}

// ── Active system pool config ─────────────────────────────────────────────────

async function getDecayRate(): Promise<number> {
  const pool = await prisma.systemPool.findFirst({ where: { isActive: true } });
  return pool?.decayRate ?? 0.01;
}

// ── Core score computation ────────────────────────────────────────────────────

/**
 * Compute and persist scoreContribution for a single verified activity.
 * Safe to call multiple times — idempotent via update.
 */
export async function computeActivityScore(activityId: string): Promise<number> {
  const activity = await prisma.activityEvent.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      contributionWeight: true,
      hoursLogged: true,
      createdAt: true,
      status: true,
    },
  });

  if (!activity || activity.status !== 'verified') return 0;

  const decayRate = await getDecayRate();
  const score =
    activity.contributionWeight *
    hoursFactor(activity.hoursLogged) *
    timeDecay(activity.createdAt, decayRate);

  await prisma.activityEvent.update({
    where: { id: activityId },
    data: { scoreContribution: score },
  });

  return score;
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Recompute and upsert the ContributionScore for a user in a cycle.
 * Sums scoreContribution from all verified activities.
 */
export async function aggregateUserScore(userId: string, cycleId: string): Promise<number> {
  // Ensure all verified activities have a scoreContribution
  const unscored = await prisma.activityEvent.findMany({
    where: { userId, cycleId, status: 'verified', scoreContribution: null },
    select: { id: true },
  });

  for (const a of unscored) {
    await computeActivityScore(a.id);
  }

  // Sum all scored verified activities
  const result = await prisma.activityEvent.aggregate({
    where: { userId, cycleId, status: 'verified', scoreContribution: { not: null } },
    _sum: { scoreContribution: true },
  });

  const totalScore = result._sum.scoreContribution ?? 0;

  await prisma.contributionScore.upsert({
    where: { userId_cycleId: { userId, cycleId } },
    update: { score: totalScore, lastUpdatedAt: new Date() },
    create: { userId, cycleId, score: totalScore },
  });

  return totalScore;
}

/**
 * Recompute scores for ALL active participants across ALL active cycles.
 * Called by the aggregation cron job.
 */
export async function aggregateAllScores(): Promise<{ updated: number }> {
  const activeCycles = await prisma.buildCycle.findMany({
    where: { state: 'active' },
    select: { id: true },
  });

  let updated = 0;

  for (const cycle of activeCycles) {
    const participants = await prisma.cycleParticipation.findMany({
      where: { cycleId: cycle.id, optedIn: true },
      select: { userId: true },
    });

    for (const p of participants) {
      await aggregateUserScore(p.userId, cycle.id);
      updated++;
    }
  }

  return { updated };
}
