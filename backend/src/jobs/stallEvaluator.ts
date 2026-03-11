import { prisma } from '../config/database';
import { NotificationService } from '../services/notificationService';

export class StallEvaluatorJob {
  static async run() {
    console.log('Running stall evaluator job...');

    try {
      // Get all active cycles
      const activeCycles = await prisma.buildCycle.findMany({
        where: { state: 'active' }
      });

      for (const cycle of activeCycles) {
        // Get all opted-in participants for this cycle
        const participants = await prisma.cycleParticipation.findMany({
          where: {
            cycleId: cycle.id,
            optedIn: true
          }
        });

        for (const participant of participants) {
          const daysSinceLastActivity = this.calculateDaysSinceLastActivity(participant.lastActivityDate);
          const newStallStage = this.determineStallStage(daysSinceLastActivity);
          const newParticipationStatus = this.determineParticipationStatus(newStallStage);

          // Only update if stage has changed
          if (newStallStage !== participant.stallStage || newParticipationStatus !== participant.participationStatus) {
            await prisma.cycleParticipation.update({
              where: { id: participant.id },
              data: {
                stallStage: newStallStage,
                participationStatus: newParticipationStatus
              }
            });

            // Send notification for stall warnings
            if (['at_risk', 'diminishing', 'paused'].includes(newStallStage) && newStallStage !== participant.stallStage) {
              await NotificationService.createStallWarning(
                participant.userId,
                cycle.id,
                newStallStage
              );
            }

            console.log(`Updated participant ${participant.userId} in cycle ${cycle.id}: ${participant.stallStage} -> ${newStallStage}`);
          }
        }
      }

      console.log('Stall evaluator job completed successfully');
    } catch (error) {
      console.error('Error in stall evaluator job:', error);
      throw error;
    }
  }

  private static calculateDaysSinceLastActivity(lastActivityDate: Date | null): number {
    if (!lastActivityDate) {
      return 0; // Grace period for new participants
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastActivityDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  private static determineStallStage(daysSinceLastActivity: number): string {
    if (daysSinceLastActivity === 0) return 'grace';
    if (daysSinceLastActivity <= 6) return 'active';
    if (daysSinceLastActivity <= 13) return 'at_risk';
    if (daysSinceLastActivity <= 20) return 'diminishing';
    return 'paused';
  }

  private static determineParticipationStatus(stallStage: string): string {
    switch (stallStage) {
      case 'grace':
        return 'grace';
      case 'active':
        return 'active';
      case 'at_risk':
        return 'at-risk';
      case 'diminishing':
      case 'paused':
        return 'paused';
      default:
        return 'active';
    }
  }
}