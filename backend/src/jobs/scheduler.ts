import cron from 'node-cron';
import { StallEvaluatorJob } from './stallEvaluator';
import { AdjustMultiplierJob } from './adjustMultiplier';
import { ActivityArchiverJob } from './activityArchiver';
import { OwnershipDecayJob } from './ownershipDecay';
import { CycleFinalizerJob } from './cycleFinalizer';

export class JobScheduler {
  static start() {
    console.log('Starting job scheduler...');

    // Run stall evaluator daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily stall evaluator job');
      try {
        await StallEvaluatorJob.run();
      } catch (error) {
        console.error('Stall evaluator job failed:', error);
      }
    });

    // Run multiplier adjustment daily at 3 AM (after stall evaluator)
    cron.schedule('0 3 * * *', async () => {
      console.log('Running daily multiplier adjustment job');
      try {
        await AdjustMultiplierJob.run();
      } catch (error) {
        console.error('Multiplier adjustment job failed:', error);
      }
    });

    // Run ownership decay weekly on Sundays at 1 AM
    cron.schedule('0 1 * * 0', async () => {
      console.log('Running weekly ownership decay job');
      try {
        await OwnershipDecayJob.run();
      } catch (error) {
        console.error('Ownership decay job failed:', error);
      }
    });

    // Run cycle finalizer daily at 4 AM
    cron.schedule('0 4 * * *', async () => {
      console.log('Running daily cycle finalizer job');
      try {
        await CycleFinalizerJob.run();
      } catch (error) {
        console.error('Cycle finalizer job failed:', error);
      }
    });

    // Run activity archiver weekly on Sundays at 5 AM (after finalization)
    cron.schedule('0 5 * * 0', async () => {
      console.log('Running weekly activity archiver job');
      try {
        await ActivityArchiverJob.run();
      } catch (error) {
        console.error('Activity archiver job failed:', error);
      }
    });

    console.log('Job scheduler started successfully');
  }

  // Manual job execution for testing/admin purposes
  static async runStallEvaluator() {
    return StallEvaluatorJob.run();
  }

  static async runMultiplierAdjustment() {
    return AdjustMultiplierJob.run();
  }

  static async runActivityArchiver() {
    return ActivityArchiverJob.run();
  }

  static async runOwnershipDecay() {
    return OwnershipDecayJob.run();
  }

  static async runCycleFinalizer() {
    return CycleFinalizerJob.run();
  }

  static async finalizeCycle(cycleId: string) {
    return CycleFinalizerJob.finalizeCycleById(cycleId);
  }
}