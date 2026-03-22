import { prisma } from '../config/database';
import { getTotalCycleScore, getSystemPool } from './aggregationService';
import { assertOwnershipWriteIsAudited } from './integrityService';

export class OwnershipService {
  /**
   * Single source of truth for ownership calculation.
   * effectiveOwnership = vestedOwnership + (provisionalOwnership × multiplier)
   */
  static async calculateEffectiveOwnership(userId: string, cycleId: string) {
    const [ledgerEntries, latestMultiplier, cycle] = await Promise.all([
      prisma.ownershipLedger.findMany({ where: { userId, cycleId }, orderBy: { createdAt: 'desc' } }),
      prisma.multiplier.findFirst({ where: { userId, cycleId }, orderBy: { createdAt: 'desc' } }),
      prisma.buildCycle.findUnique({ where: { id: cycleId } }),
    ]);

    const totalOwnership = ledgerEntries.reduce((sum, e) => sum + e.ownershipAmount, 0);
    const multiplier = latestMultiplier?.multiplier ?? 1.0;

    // Vesting: linear from 0% at cycle start to 100% at cycle end
    let vestedPercentage = 0;
    if (cycle) {
      const now = Date.now();
      const start = new Date(cycle.startDate).getTime();
      const end = new Date(cycle.endDate).getTime();
      vestedPercentage = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1;
    }

    const vestedOwnership = totalOwnership * vestedPercentage;
    const provisionalOwnership = totalOwnership - vestedOwnership;
    // Core formula: vested + (provisional × multiplier)
    const effectiveOwnership = vestedOwnership + provisionalOwnership * multiplier;

    return {
      totalOwnership,
      vestedOwnership,
      provisionalOwnership,
      multiplier,
      effectiveOwnership,
      vestedPercentage: Math.round(vestedPercentage * 100),
      entriesCount: ledgerEntries.length,
      entries: ledgerEntries,
    };
  }

  static async computeOwnership(userId: string, cycleId: string) {
    try {
      const result = await OwnershipService.calculateEffectiveOwnership(userId, cycleId);
      return { success: true, ...result };
    } catch (error) {
      console.error('Error computing ownership:', error);
      return { success: false, error: 'Failed to compute ownership' };
    }
  }

  static async createOwnershipEntry(
    userId: string,
    cycleId: string,
    eventType: string,
    ownershipAmount: number,
    sourceReference?: string,
    createdBy?: string,
    auditReason?: string
  ) {
    try {
      // ISSUE 1: guard against unsanctioned manual ownership writes
      // Only system-approved event types are allowed without an explicit audit reason
      assertOwnershipWriteIsAudited(eventType, createdBy ?? 'system', auditReason);

      // Get current multiplier
      const latestMultiplier = await prisma.multiplier.findFirst({
        where: { userId, cycleId },
        orderBy: { createdAt: 'desc' }
      });

      const multiplierSnapshot = latestMultiplier?.multiplier || 1.0;

      const entry = await prisma.ownershipLedger.create({
        data: {
          userId,
          cycleId,
          eventType,
          ownershipAmount,
          multiplierSnapshot,
          sourceReference,
          createdBy: createdBy || 'system'
        }
      });

      return entry;
    } catch (error) {
      console.error('Error creating ownership entry:', error);
      throw error;
    }
  }

  // ── NEW: Normalized Ownership Economy Engine ────────────────────────────────

  /**
   * Compute normalized ownership % for a user in a cycle.
   * Formula: (userScore / totalScore) × contributorPoolPct
   *
   * Stores result in the latest OwnershipLedger entry's normalizedOwnershipPct.
   * Falls back to 0 safely when totalScore = 0 or data is missing.
   * DOES NOT modify ownershipAmount, multiplier, or vesting logic.
   */
  static async computeNormalizedOwnership(
    userId: string,
    cycleId: string
  ): Promise<{
    userId: string;
    normalizedOwnershipPct: number;
    contributionScore: number;
    totalSystemScore: number;
    contributorPoolPct: number;
  }> {
    try {
      const [scoreRow, totalScore, pool] = await Promise.all([
        prisma.contributionScore.findUnique({
          where: { userId_cycleId: { userId, cycleId } },
        }),
        getTotalCycleScore(cycleId),
        getSystemPool(),
      ]);

      const userScore = scoreRow?.score ?? 0;
      const contributorPoolPct = pool.contributorPoolPct;

      // Safety: never divide by zero, never exceed pool
      const normalizedOwnershipPct =
        totalScore > 0
          ? Math.min((userScore / totalScore) * contributorPoolPct, contributorPoolPct)
          : 0;

      // Persist to the most recent ledger entry for this user/cycle (if one exists)
      const latestEntry = await prisma.ownershipLedger.findFirst({
        where: { userId, cycleId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestEntry) {
        await prisma.ownershipLedger.update({
          where: { id: latestEntry.id },
          data: { normalizedOwnershipPct },
        });
      }

      return {
        userId,
        normalizedOwnershipPct,
        contributionScore: userScore,
        totalSystemScore: totalScore,
        contributorPoolPct,
      };
    } catch (error) {
      console.error('Error computing normalized ownership:', error);
      // Fallback — never crash
      return {
        userId,
        normalizedOwnershipPct: 0,
        contributionScore: 0,
        totalSystemScore: 0,
        contributorPoolPct: 0.4,
      };
    }
  }

  /**
   * Run normalization for all active participants across all active cycles.
   * Called by the normalization cron job.
   */
  static async normalizeAllOwnership(): Promise<{ updated: number }> {
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
        await OwnershipService.computeNormalizedOwnership(p.userId, cycle.id);
        updated++;
      }
    }
    return { updated };
  }
}