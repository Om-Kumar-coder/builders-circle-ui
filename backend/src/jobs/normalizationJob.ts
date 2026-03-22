/**
 * Normalization Job
 * Computes normalized ownership % for all active participants.
 * Runs after the aggregation job so scores are fresh.
 */

import { OwnershipService } from '../services/ownershipService';

export class NormalizationJob {
  static async run(): Promise<{ updated: number }> {
    console.log('Running normalization job...');
    try {
      const result = await OwnershipService.normalizeAllOwnership();
      console.log(`Normalization job: updated ${result.updated} ownership records`);
      return result;
    } catch (error) {
      console.error('Normalization job failed:', error);
      throw error;
    }
  }
}
