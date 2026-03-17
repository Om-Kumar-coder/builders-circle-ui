import { prisma } from '../config/database';

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
    createdBy?: string
  ) {
    try {
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
}