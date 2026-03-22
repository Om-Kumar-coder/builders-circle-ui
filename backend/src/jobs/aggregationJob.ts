/**
 * Aggregation Job
 * Periodically recomputes per-user ContributionScore totals
 * for all active participants in active cycles.
 */

import { aggregateAllScores } from '../services/contributionScoreService';

export class AggregationJob {
  static async run(): Promise<{ updated: number }> {
    console.log('Running aggregation job...');
    try {
      const result = await aggregateAllScores();
      console.log(`Aggregation job: updated ${result.updated} user scores`);
      return result;
    } catch (error) {
      console.error('Aggregation job failed:', error);
      throw error;
    }
  }
}
