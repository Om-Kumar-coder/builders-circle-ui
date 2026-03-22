/**
 * Score Computation Job
 * Runs after activity verification windows to write scoreContribution
 * on all newly-verified activities that haven't been scored yet.
 */

import { prisma } from '../config/database';
import { computeActivityScore } from '../services/contributionScoreService';

export class ScoreComputationJob {
  static async run(): Promise<{ scored: number }> {
    console.log('Running score computation job...');

    try {
      // Find verified activities with no scoreContribution yet
      const unscored = await prisma.activityEvent.findMany({
        where: { status: 'verified', scoreContribution: null },
        select: { id: true },
      });

      let scored = 0;
      for (const activity of unscored) {
        await computeActivityScore(activity.id);
        scored++;
      }

      console.log(`Score computation job: scored ${scored} activities`);
      return { scored };
    } catch (error) {
      console.error('Score computation job failed:', error);
      throw error;
    }
  }
}
