/**
 * Tier Evaluation Job — Phase 2b
 *
 * Evaluates tier scores for all active users on an hourly schedule and
 * upserts their tier assignment to the user_tiers table.
 *
 * Formula:
 *   tierScore = (ownershipWeight × normalizedOwnership) +
 *               (contributionWeight × normalizedContribution) +
 *               (reputationWeight × normalizedReputation) +
 *               (cycleWeight × normalizedCycles) +
 *               (veronicaWeight × normalizedVeronica)
 *
 * Tier mapping uses the configurable TierThreshold table.
 * Founder and employee tiers are role-based (cannot be earned through scoring).
 * Tier downgrades are logged for observability.
 */

import { prisma } from '../config/database';
import { OwnershipService } from '../services/ownershipService';

// ── Default weights (used when TierThreshold minScores are the reference) ─────

const TIER_WEIGHTS = {
  ownership: 3.0,
  contribution: 2.0,
  reputation: 1.5,
  cycles: 1.0,
  veronica: 0.5,
};

const TOTAL_WEIGHT = Object.values(TIER_WEIGHTS).reduce((a, b) => a + b, 0);

// ── Tier mapping logic ────────────────────────────────────────────────────────

interface TierEvalResult {
  userId: string;
  tier: string;
  tierScore: number;
  componentScores: {
    ownership: number;      // normalized 0-1
    contribution: number;   // normalized 0-1
    reputation: number;     // normalized 0-1
    cycles: number;         // normalized 0-1
    veronica: number;       // normalized 0-1
  };
  previousTier: string | null;
  changed: boolean;
}

/**
 * Load active tier thresholds from the DB.
 * Falls back to hardcoded defaults if the table is empty.
 */
async function loadTierThresholds(): Promise<Record<string, { minScore: number; minCycles: number }>> {
  const rows = await prisma.tierThreshold.findMany({
    where: { isActive: true },
    select: { tier: true, minScore: true, minCycles: true },
  });
  if (rows.length > 0) {
    const map: Record<string, { minScore: number; minCycles: number }> = {};
    for (const r of rows) map[r.tier] = { minScore: r.minScore, minCycles: r.minCycles };
    return map;
  }

  console.warn('[TierEval] TierThreshold table is empty — using hardcoded defaults');
  return {
    founder:     { minScore: 80, minCycles: 0 },
    core:        { minScore: 60, minCycles: 3 },
    contributor: { minScore: 30, minCycles: 0 },
    employee:    { minScore: 0,  minCycles: 0 },
    observer:    { minScore: 0,  minCycles: 0 },
  };
}

/**
 * Given a numeric tierScore and the user's role + cycle count, determine
 * which tier the user belongs to.
 *
 * - founder / employee: role-based, never assigned by score alone
 * - core: minScore >= 60 AND minCycles >= 3
 * - contributor: minScore >= 30 (and not meeting core)
 * - observer: fallback / < 30
 */
function determineTier(
  tierScore: number,
  role: string,
  cycleCount: number,
  thresholds: Record<string, { minScore: number; minCycles: number }>,
): string {
  // Role-based tiers are never overridden by scoring
  if (role === 'founder') return 'founder';
  if (role === 'employee') return 'employee';
  if (role === 'observer') return 'observer';

  const coreThresh = thresholds.core;
  if (tierScore >= coreThresh.minScore && cycleCount >= coreThresh.minCycles) {
    return 'core';
  }

  const contribThresh = thresholds.contributor;
  if (tierScore >= contribThresh.minScore) {
    return 'contributor';
  }

  return 'observer';
}

/**
 * Evaluate a single user's tier score and assignment.
 */
async function evaluateUserTier(
  userId: string,
  thresholds: Record<string, { minScore: number; minCycles: number }>,
): Promise<TierEvalResult> {
  // 1. Load user profile for role
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { role: true },
  });
  const role = profile?.role ?? 'contributor';

  // 2. Load active cycles for ownership computation
  const activeCycles = await prisma.buildCycle.findMany({
    where: { state: 'active' },
    select: { id: true },
  });

  // 3. Compute normalized ownership across all active cycles
  let totalEffectiveOwnership = 0;
  for (const cycle of activeCycles) {
    const ownership = await OwnershipService.calculateEffectiveOwnership(userId, cycle.id);
    totalEffectiveOwnership += ownership.effectiveOwnership;
  }
  // Normalize ownership to 0-1 (cap at a reasonable maximum, e.g. 10% effective ownership = 1.0)
  const normalizedOwnership = Math.min(1, totalEffectiveOwnership / 0.1);

  // 4. Load contribution score (latest across all cycles)
  const contributionScore = await prisma.contributionScore.findFirst({
    where: { userId },
    orderBy: { lastUpdatedAt: 'desc' },
    select: { score: true },
  });
  // Normalize contribution: typical max ~100, cap at 1.0
  const normalizedContribution = Math.min(1, (contributionScore?.score ?? 0) / 100);

  // 5. Load reputation
  const reputation = await prisma.contributorReputation.findUnique({
    where: { userId },
    select: { reputationScore: true },
  });
  // Normalize reputation: typical max ~500, cap at 1.0
  const normalizedReputation = Math.min(1, (reputation?.reputationScore ?? 0) / 500);

  // 6. Count completed cycles
  const cycleCount = await prisma.cycleParticipation.count({
    where: { userId, optedIn: true },
  });
  // Normalize cycles: 10+ cycles = 1.0
  const normalizedCycles = Math.min(1, cycleCount / 10);

  // 7. Average Veronica score from gatekeeper reviews
  const veronicaReview = await prisma.gatekeeperReview.findFirst({
    where: { entityId: userId, entityType: { in: ['user_intake', 'submission'] } },
    orderBy: { createdAt: 'desc' },
    select: { veronicaScore: true },
  });
  const normalizedVeronica = veronicaReview?.veronicaScore ?? 0.5;

  // 8. Compute weighted tier score
  const tierScore =
    (TIER_WEIGHTS.ownership * normalizedOwnership +
     TIER_WEIGHTS.contribution * normalizedContribution +
     TIER_WEIGHTS.reputation * normalizedReputation +
     TIER_WEIGHTS.cycles * normalizedCycles +
     TIER_WEIGHTS.veronica * normalizedVeronica) / TOTAL_WEIGHT;

  // 9. Map to tier
  const previousRow = await prisma.userTier.findUnique({
    where: { userId },
    select: { tier: true },
  });
  const previousTier = previousRow?.tier ?? null;
  const tier = determineTier(tierScore, role, cycleCount, thresholds);
  const changed = previousTier !== tier;

  return {
    userId,
    tier,
    tierScore,
    componentScores: {
      ownership: normalizedOwnership,
      contribution: normalizedContribution,
      reputation: normalizedReputation,
      cycles: normalizedCycles,
      veronica: normalizedVeronica,
    },
    previousTier,
    changed,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export class TierEvaluationJob {
  /**
   * Evaluate tiers for all active users and upsert results.
   * Returns counts for total evaluated, changed, and errored.
   */
  static async run(): Promise<{
    evaluated: number;
    changed: number;
    errors: number;
    details: Array<{ userId: string; tier: string; previousTier: string | null; changed: boolean }>;
  }> {
    console.log('[TierEval] Starting tier evaluation...');
    const start = Date.now();

    const thresholds = await loadTierThresholds();

    // Load all users with profiles (active users)
    const users = await prisma.user.findMany({
      where: {
        profile: { isNot: null },
      },
      select: { id: true },
    });

    let evaluated = 0;
    let changed = 0;
    let errors = 0;
    const details: Array<{ userId: string; tier: string; previousTier: string | null; changed: boolean }> = [];

    for (const user of users) {
      try {
        const result = await evaluateUserTier(user.id, thresholds);

        // Persist to UserTier
        await prisma.userTier.upsert({
          where: { userId: user.id },
          update: {
            tier: result.tier,
            tierScore: result.tierScore,
            componentScores: JSON.stringify(result.componentScores),
            previousTier: result.previousTier,
            evaluatedAt: new Date(),
          },
          create: {
            userId: user.id,
            tier: result.tier,
            tierScore: result.tierScore,
            componentScores: JSON.stringify(result.componentScores),
            previousTier: result.previousTier,
          },
        });

        evaluated++;
        if (result.changed) changed++;
        details.push({
          userId: user.id,
          tier: result.tier,
          previousTier: result.previousTier,
          changed: result.changed,
        });
      } catch (err) {
        errors++;
        console.error(`[TierEval] Failed to evaluate user ${user.id}:`, err);
      }
    }

    const elapsed = Date.now() - start;
    console.log(
      `[TierEval] Complete — evaluated: ${evaluated}, changed: ${changed}, errors: ${errors}, elapsed: ${elapsed}ms`,
    );

    return { evaluated, changed, errors, details };
  }

  /**
   * Preview a single user's tier score without persisting (for admin/manual use).
   */
  static async previewUserTier(userId: string) {
    const thresholds = await loadTierThresholds();
    return evaluateUserTier(userId, thresholds);
  }
}

export default TierEvaluationJob;
