import cron from 'node-cron';
import { StallEvaluatorJob } from './stallEvaluator';
import { AdjustMultiplierJob } from './adjustMultiplier';
import { ActivityArchiverJob } from './activityArchiver';

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

    // Run activity archiver weekly on Sundays at 4 AM
    cron.schedule('0 4 * * 0', async () => {
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
}