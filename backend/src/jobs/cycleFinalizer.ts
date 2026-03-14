import { prisma } from '../config/database';
import { NotificationService } from '../services/notificationService';

export class CycleFinalizerJob {
  static async run() {
    console.log('Running cycle finalizer job...');

    try {
      // Find cycles that should be closed (past end date but still active)
      const now = new Date();
      const cyclesToClose = await prisma.buildCycle.findMany({
        where: {
          state: 'active',
          endDate: {
            lt: now
          }
        }
      });

      for (const cycle of cyclesToClose) {
        await this.finalizeCycle(cycle);
      }

      // Find cycles that are manually set to 'closed' but not finalized
      const closedCycles = await prisma.buildCycle.findMany({
        where: {
          state: 'closed'
        }
      });

      for (const cycle of closedCycles) {
        // Check if already finalized
        const finalizationEntry = await prisma.ownershipLedger.findFirst({
          where: {
            cycleId: cycle.id,
            eventType: 'cycle_finalized'
          }
        });

        if (!finalizationEntry) {
          await this.finalizeCycle(cycle);
        }
      }

      console.log('Cycle finalizer job completed successfully');
    } catch (error) {
      console.error('Error in cycle finalizer job:', error);
      throw error;
    }
  }

  static async finalizeCycle(cycle: { id: string; name: string; state: string; startDate?: Date; endDate?: Date }) {
    console.log(`Finalizing cycle: ${cycle.name} (${cycle.id})`);

    try {
      // 1. Update cycle state to closed if not already
      if (cycle.state !== 'closed') {
        await prisma.buildCycle.update({
          where: { id: cycle.id },
          data: { state: 'closed' }
        });
      }

      // 2. Get all participants in this cycle
      const participants = await prisma.cycleParticipation.findMany({
        where: { cycleId: cycle.id },
        include: { user: true }
      });

      // 3. Mark all participation records as closed
      await prisma.cycleParticipation.updateMany({
        where: { cycleId: cycle.id },
        data: { 
          participationStatus: 'closed',
          stallStage: 'closed'
        }
      });

      // 4. Calculate final ownership for each participant
      for (const participant of participants) {
        const finalOwnership = await this.calculateFinalOwnership(participant.userId, cycle.id);
        
        // Create final ledger entry
        await prisma.ownershipLedger.create({
          data: {
            userId: participant.userId,
            cycleId: cycle.id,
            eventType: 'cycle_finalized',
            ownershipAmount: 0, // No ownership change, just marking finalization
            multiplierSnapshot: finalOwnership.currentMultiplier,
            sourceReference: `final_ownership_${finalOwnership.totalOwnership.toFixed(6)}`,
            createdBy: 'system'
          }
        });

        // Send finalization notification
        await NotificationService.createNotification(
          participant.userId,
          'cycle_finalized',
          `Build cycle "${cycle.name}" has been finalized. Your final ownership: ${finalOwnership.totalOwnership.toFixed(4)} (${(finalOwnership.totalOwnership * 100).toFixed(2)}%)`,
          {
            cycleId: cycle.id,
            cycleName: cycle.name,
            finalOwnership: finalOwnership.totalOwnership,
            vestedOwnership: finalOwnership.vestedOwnership,
            effectiveOwnership: finalOwnership.effectiveOwnership,
            multiplier: finalOwnership.currentMultiplier
          }
        );

        console.log(`Finalized ownership for ${participant.user.email}: ${finalOwnership.totalOwnership.toFixed(4)}`);
      }

      // 5. Create system log entry
      await prisma.systemLog.create({
        data: {
          event: 'cycle_finalized',
          severity: 'INFO',
          message: `Build cycle "${cycle.name}" has been finalized with ${participants.length} participants`,
          metadata: JSON.stringify({
            cycleId: cycle.id,
            cycleName: cycle.name,
            participantCount: participants.length,
            startDate: cycle.startDate,
            endDate: cycle.endDate,
            finalizedAt: new Date()
          })
        }
      });

      console.log(`✅ Cycle finalized: ${cycle.name} with ${participants.length} participants`);

    } catch (error) {
      console.error(`Error finalizing cycle ${cycle.id}:`, error);
      
      // Create error log
      await prisma.systemLog.create({
        data: {
          event: 'cycle_finalization_error',
          severity: 'ERROR',
          message: `Failed to finalize cycle "${cycle.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: JSON.stringify({
            cycleId: cycle.id,
            cycleName: cycle.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      });
      
      throw error;
    }
  }

  private static async calculateFinalOwnership(userId: string, cycleId: string) {
    // Get all ownership ledger entries
    const ledgerEntries = await prisma.ownershipLedger.findMany({
      where: {
        userId,
        cycleId
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalOwnership = ledgerEntries.reduce((sum, entry) => sum + entry.ownershipAmount, 0);

    // Get final multiplier
    const latestMultiplier = await prisma.multiplier.findFirst({
      where: {
        userId,
        cycleId
      },
      orderBy: { createdAt: 'desc' }
    });

    const currentMultiplier = latestMultiplier?.multiplier || 1.0;
    const effectiveOwnership = totalOwnership * currentMultiplier;

    // Calculate final vested ownership (100% vested at cycle end)
    const vestedOwnership = totalOwnership;

    return {
      totalOwnership,
      vestedOwnership,
      effectiveOwnership,
      currentMultiplier,
      entriesCount: ledgerEntries.length
    };
  }

  // Manual cycle finalization (admin function)
  static async finalizeCycleById(cycleId: string) {
    const cycle = await prisma.buildCycle.findUnique({
      where: { id: cycleId }
    });

    if (!cycle) {
      throw new Error('Cycle not found');
    }

    return this.finalizeCycle(cycle);
  }
}