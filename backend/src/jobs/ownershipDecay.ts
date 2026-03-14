import { prisma } from '../config/database';

export class OwnershipDecayJob {
  static async run() {
    console.log('Running ownership decay job...');

    try {
      // Get all active cycles
      const activeCycles = await prisma.buildCycle.findMany({
        where: { state: 'active' }
      });

      for (const cycle of activeCycles) {
        // Get participants in diminishing or paused stages
        const participantsToDecay = await prisma.cycleParticipation.findMany({
          where: {
            cycleId: cycle.id,
            optedIn: true,
            stallStage: {
              in: ['diminishing', 'paused']
            }
          },
          select: { userId: true, stallStage: true }
        });

        if (participantsToDecay.length === 0) {
          console.log(`No participants to decay in cycle ${cycle.id}`);
          continue;
        }

        // OPTIMIZED: Batch fetch all ledger entries for all participants
        const ledgerEntries = await prisma.ownershipLedger.findMany({
          where: {
            cycleId: cycle.id,
            userId: { in: participantsToDecay.map(p => p.userId) }
          },
          orderBy: { createdAt: 'desc' }
        });

        // OPTIMIZED: Batch fetch all multipliers for all participants
        const multipliers = await prisma.multiplier.findMany({
          where: {
            cycleId: cycle.id,
            userId: { in: participantsToDecay.map(p => p.userId) }
          },
          orderBy: { createdAt: 'desc' }
        });

        // OPTIMIZED: Batch check last decay dates for all participants
        const lastDecays = await prisma.ownershipLedger.findMany({
          where: {
            cycleId: cycle.id,
            eventType: 'ownership_decay',
            userId: { in: participantsToDecay.map(p => p.userId) }
          },
          distinct: ['userId'],
          orderBy: { createdAt: 'desc' }
        });

        // Create lookup maps for O(1) access
        const ledgerByUser = new Map<string, typeof ledgerEntries>();
        const multiplierByUser = new Map<string, typeof multipliers[0]>();
        const lastDecayByUser = new Map<string, Date>();

        ledgerEntries.forEach(entry => {
          if (!ledgerByUser.has(entry.userId)) {
            ledgerByUser.set(entry.userId, []);
          }
          ledgerByUser.get(entry.userId)!.push(entry);
        });

        multipliers.forEach(m => {
          if (!multiplierByUser.has(m.userId)) {
            multiplierByUser.set(m.userId, m);
          }
        });

        lastDecays.forEach(decay => {
          lastDecayByUser.set(decay.userId, decay.createdAt);
        });

        // Calculate vesting percentage for the cycle
        const vestedPercentage = this.calculateVestedPercentage(cycle);

        // Process all participants and prepare batch operations
        const decayEntries = [];
        const notifications = [];

        for (const participant of participantsToDecay) {
          // Check if enough time has passed since last decay
          const lastDecay = lastDecayByUser.get(participant.userId);
          if (lastDecay) {
            const daysSinceLastDecay = Math.floor(
              (Date.now() - lastDecay.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceLastDecay < 7) {
              continue; // Skip if less than 7 days since last decay
            }
          }

          const userLedger = ledgerByUser.get(participant.userId) || [];
          const userMultiplier = multiplierByUser.get(participant.userId);

          const totalOwnership = userLedger.reduce((sum, entry) => sum + entry.ownershipAmount, 0);
          const currentMultiplier = userMultiplier?.multiplier || 1.0;

          // Calculate provisional ownership (non-vested)
          const vestedOwnership = totalOwnership * vestedPercentage;
          const provisionalOwnership = Math.max(0, totalOwnership - vestedOwnership);

          if (provisionalOwnership <= 0) {
            continue; // No provisional ownership to decay
          }

          const decayRate = this.getDecayRate(participant.stallStage);
          const decayAmount = provisionalOwnership * decayRate;

          // Don't decay if amount is negligible
          if (decayAmount < 0.001) {
            continue;
          }

          decayEntries.push({
            userId: participant.userId,
            cycleId: cycle.id,
            eventType: 'ownership_decay',
            ownershipAmount: -decayAmount,
            multiplierSnapshot: currentMultiplier,
            sourceReference: `decay_${participant.stallStage}_${new Date().toISOString().split('T')[0]}`,
            createdBy: 'system'
          });

          notifications.push({
            userId: participant.userId,
            type: 'ownership_decay',
            message: `Your provisional ownership decreased by ${(decayRate * 100).toFixed(1)}% due to inactivity (${participant.stallStage} stage).`,
            metadata: JSON.stringify({
              cycleId: cycle.id,
              decayAmount,
              decayRate,
              stallStage: participant.stallStage,
              remainingProvisional: provisionalOwnership - decayAmount
            })
          });

          console.log(`Prepared decay for user ${participant.userId}: ${decayAmount.toFixed(4)} (${(decayRate * 100).toFixed(1)}%)`);
        }

        // OPTIMIZED: Batch create all decay entries and notifications
        if (decayEntries.length > 0) {
          await prisma.ownershipLedger.createMany({ data: decayEntries });
          await prisma.notification.createMany({ data: notifications });
          console.log(`Applied decay to ${decayEntries.length} participants in cycle ${cycle.id}`);
        } else {
          console.log(`No participants needed decay in cycle ${cycle.id}`);
        }
      }

      console.log('Ownership decay job completed successfully');
    } catch (error) {
      console.error('Error in ownership decay job:', error);
      throw error;
    }
  }

  private static calculateVestedPercentage(cycle: { startDate: Date | string; endDate: Date | string }): number {
    const now = new Date();
    const cycleStart = new Date(cycle.startDate);
    const cycleEnd = new Date(cycle.endDate);
    const cycleDuration = cycleEnd.getTime() - cycleStart.getTime();
    const elapsed = Math.max(0, now.getTime() - cycleStart.getTime());
    
    // Linear vesting: 0% at start, 100% at end
    return Math.min(1, elapsed / cycleDuration);
  }

  private static getDecayRate(stallStage: string): number {
    // Decay rates per week
    const decayRates = {
      'diminishing': 0.05, // 5% per week
      'paused': 0.10       // 10% per week
    };

    return decayRates[stallStage as keyof typeof decayRates] || 0;
  }
}