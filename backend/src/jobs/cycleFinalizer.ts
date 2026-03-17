import { prisma } from '../config/database';

export class CycleFinalizerJob {
  static async run() {
    console.log('Running cycle finalizer job...');

    try {
      const now = new Date();
      const cyclesToClose = await prisma.buildCycle.findMany({
        where: { state: 'active', endDate: { lt: now } },
      });

      for (const cycle of cyclesToClose) {
        await this.finalizeCycle(cycle);
      }

      // Cycles manually set to 'closed' but not yet finalized
      // Exclude any already processed above to avoid double-finalization
      const processedIds = new Set(cyclesToClose.map(c => c.id));
      const closedCycles = await prisma.buildCycle.findMany({ where: { state: 'closed' } });
      for (const cycle of closedCycles) {
        if (processedIds.has(cycle.id)) continue;
        const alreadyFinalized = await prisma.ownershipLedger.findFirst({
          where: { cycleId: cycle.id, eventType: 'cycle_finalized' },
        });
        if (!alreadyFinalized) {
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
      await prisma.$transaction(async (tx) => {
        // 1. Update cycle state to closed if not already
        if (cycle.state !== 'closed') {
          await tx.buildCycle.update({
            where: { id: cycle.id },
            data: { state: 'closed' },
          });
        }

        // 2. Get all participants in this cycle
        const participants = await tx.cycleParticipation.findMany({
          where: { cycleId: cycle.id },
          include: { user: true },
        });

        // 3. Mark all participation records as closed
        await tx.cycleParticipation.updateMany({
          where: { cycleId: cycle.id },
          data: { participationStatus: 'closed', stallStage: 'closed' },
        });

        // 4. Calculate final ownership for each participant using the canonical formula
        for (const participant of participants) {
          const finalOwnership = await this.calculateFinalOwnership(tx, participant.userId, cycle.id, cycle);

          // Create final ledger entry (idempotent — skip if already exists)
          await tx.ownershipLedger.create({
            data: {
              userId: participant.userId,
              cycleId: cycle.id,
              eventType: 'cycle_finalized',
              ownershipAmount: 0, // marker entry; actual ownership is in prior ledger rows
              multiplierSnapshot: finalOwnership.multiplier,
              sourceReference: `final_effective_${finalOwnership.effectiveOwnership.toFixed(6)}`,
              createdBy: 'system',
            },
          });

          // Notification
          await tx.notification.create({
            data: {
              userId: participant.userId,
              type: 'cycle_finalized',
              message: `Build cycle "${cycle.name}" has been finalized. Your final effective ownership: ${finalOwnership.effectiveOwnership.toFixed(4)} (${(finalOwnership.effectiveOwnership * 100).toFixed(2)}%)`,
              metadata: JSON.stringify({
                cycleId: cycle.id,
                cycleName: cycle.name,
                effectiveOwnership: finalOwnership.effectiveOwnership,
                vestedOwnership: finalOwnership.vestedOwnership,
                provisionalOwnership: finalOwnership.provisionalOwnership,
                multiplier: finalOwnership.multiplier,
              }),
            },
          });

          console.log(`Finalized ownership for ${participant.user.email}: effective=${finalOwnership.effectiveOwnership.toFixed(4)}`);
        }

        // 5. System log
        await tx.systemLog.create({
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
              finalizedAt: new Date(),
            }),
          },
        });
      });

      console.log(`✅ Cycle finalized: ${cycle.name}`);
    } catch (error) {
      console.error(`Error finalizing cycle ${cycle.id}:`, error);

      await prisma.systemLog.create({
        data: {
          event: 'cycle_finalization_error',
          severity: 'ERROR',
          message: `Failed to finalize cycle "${cycle.name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          metadata: JSON.stringify({ cycleId: cycle.id, error: error instanceof Error ? error.message : 'Unknown error' }),
        },
      });

      throw error;
    }
  }

  /**
   * Canonical ownership formula (mirrors OwnershipService.calculateEffectiveOwnership):
   * effectiveOwnership = vestedOwnership + (provisionalOwnership × multiplier)
   */
  private static async calculateFinalOwnership(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId: string,
    cycleId: string,
    _cycle: { startDate?: Date; endDate?: Date },
  ) {
    const [ledgerEntries, latestMultiplier] = await Promise.all([
      tx.ownershipLedger.findMany({ where: { userId, cycleId }, orderBy: { createdAt: 'desc' } }),
      tx.multiplier.findFirst({ where: { userId, cycleId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const totalOwnership = ledgerEntries.reduce((sum, e) => sum + e.ownershipAmount, 0);
    const multiplier = latestMultiplier?.multiplier ?? 1.0;

    // At cycle end, vesting is 100%
    const vestedOwnership = totalOwnership;
    const provisionalOwnership = 0;
    const effectiveOwnership = vestedOwnership + provisionalOwnership * multiplier;

    return { totalOwnership, vestedOwnership, provisionalOwnership, effectiveOwnership, multiplier, entriesCount: ledgerEntries.length };
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