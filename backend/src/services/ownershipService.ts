import { prisma } from '../config/database';

export class OwnershipService {
  static async computeOwnership(userId: string, cycleId: string) {
    try {
      // Get all ownership ledger entries for user in cycle
      const ledgerEntries = await prisma.ownershipLedger.findMany({
        where: {
          userId,
          cycleId
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate total ownership
      const totalOwnership = ledgerEntries.reduce((sum, entry) => sum + entry.ownershipAmount, 0);

      // Get latest multiplier
      const latestMultiplier = await prisma.multiplier.findFirst({
        where: {
          userId,
          cycleId
        },
        orderBy: { createdAt: 'desc' }
      });

      const multiplier = latestMultiplier?.multiplier || 1.0;
      const effectiveOwnership = totalOwnership * multiplier;

      return {
        success: true,
        totalOwnership,
        multiplier,
        effectiveOwnership,
        entriesCount: ledgerEntries.length
      };
    } catch (error) {
      console.error('Error computing ownership:', error);
      return {
        success: false,
        error: 'Failed to compute ownership'
      };
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