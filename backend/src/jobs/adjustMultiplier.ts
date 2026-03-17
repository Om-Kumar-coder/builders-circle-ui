import { prisma } from '../config/database';
import { OwnershipService } from '../services/ownershipService';
import { NotificationService } from '../services/notificationService';

export class AdjustMultiplierJob {
  static async run() {
    console.log('Running adjust multiplier job...');

    try {
      // Get all active cycles
      const activeCycles = await prisma.buildCycle.findMany({
        where: { state: 'active' }
      });

      for (const cycle of activeCycles) {
        // Batch fetch participants and their latest multipliers in two queries
        const participants = await prisma.cycleParticipation.findMany({
          where: { cycleId: cycle.id, optedIn: true },
        });

        const latestMultipliers = await prisma.multiplier.findMany({
          where: {
            cycleId: cycle.id,
            userId: { in: participants.map(p => p.userId) },
          },
          orderBy: { createdAt: 'desc' },
          distinct: ['userId'],
        });

        const multiplierMap = new Map(latestMultipliers.map(m => [m.userId, m.multiplier]));

        for (const participant of participants) {
          const targetMultiplier = this.getMultiplierForStallStage(participant.stallStage);
          const currentMultiplierValue = multiplierMap.get(participant.userId) ?? 1.0;

          // Only update if multiplier has changed
          if (Math.abs(targetMultiplier - currentMultiplierValue) > 0.001) {
            await prisma.multiplier.create({
              data: {
                userId: participant.userId,
                cycleId: cycle.id,
                multiplier: targetMultiplier,
                reason: `Stall stage adjustment: ${participant.stallStage}`,
              },
            });

            await OwnershipService.createOwnershipEntry(
              participant.userId,
              cycle.id,
              'multiplier_adjustment',
              0,
              undefined,
              'system'
            );

            await NotificationService.createMultiplierChange(
              participant.userId,
              cycle.id,
              currentMultiplierValue,
              targetMultiplier
            );

            console.log(`Updated multiplier for participant ${participant.userId} in cycle ${cycle.id}: ${currentMultiplierValue} -> ${targetMultiplier}`);
          }
        }
      }

      console.log('Adjust multiplier job completed successfully');
    } catch (error) {
      console.error('Error in adjust multiplier job:', error);
      throw error;
    }
  }

  private static getMultiplierForStallStage(stallStage: string): number {
    const multiplierMap: { [key: string]: number } = {
      'grace': 1.0,
      'active': 1.0,
      'none': 1.0,
      'at_risk': 0.75,
      'diminishing': 0.5,
      'paused': 0.0
    };

    return multiplierMap[stallStage] || 1.0;
  }
}