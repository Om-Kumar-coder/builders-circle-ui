import { prisma } from '../config/database';
import { triggerEmail } from '../services/emailService';

export class StallEvaluatorJob {
  static async run() {
    console.log('Running stall evaluator job...');

    try {
      // OPTIMIZED: Get all active cycles with their participants in one query
      // This eliminates the N+1 query pattern (1 query for cycles + N queries for participants)
      const activeCycles = await prisma.buildCycle.findMany({
        where: { state: 'active' },
        include: {
          participations: {
            where: { optedIn: true },
            select: {
              id: true,
              userId: true,
              lastActivityDate: true,
              createdAt: true,
              stallStage: true,
              participationStatus: true
            }
          }
        }
      });

      for (const cycle of activeCycles) {
        // Calculate all updates in memory first
        const updates = cycle.participations.map(participant => {
          const daysSinceLastActivity = this.calculateDaysSinceLastActivity(
            participant.lastActivityDate,
            participant.createdAt
          );
          const daysSinceJoined = this.calculateDaysSinceLastActivity(
            null,
            participant.createdAt
          );

          const newStallStage = this.determineStallStage(daysSinceLastActivity, daysSinceJoined);
          const newParticipationStatus = this.determineParticipationStatus(newStallStage);

          return {
            id: participant.id,
            userId: participant.userId,
            newStallStage,
            newParticipationStatus,
            oldStallStage: participant.stallStage,
            oldParticipationStatus: participant.participationStatus,
            shouldUpdate: newStallStage !== participant.stallStage || newParticipationStatus !== participant.participationStatus,
            shouldNotify: ['at_risk', 'diminishing', 'paused'].includes(newStallStage) &&
              newStallStage !== participant.stallStage &&
              participant.stallStage !== 'grace',
            daysSinceJoined,
            daysSinceLastActivity
          };
        });

        // OPTIMIZED: Batch update all participants that need changes
        const participantsToUpdate = updates.filter(u => u.shouldUpdate);
        
        for (const update of participantsToUpdate) {
          await prisma.cycleParticipation.update({
            where: { id: update.id },
            data: {
              stallStage: update.newStallStage,
              participationStatus: update.newParticipationStatus
            }
          });

          console.log(`Updated participant ${update.userId} in cycle ${cycle.id}: ${update.oldStallStage} -> ${update.newStallStage} (${update.daysSinceJoined} days since joined, ${update.daysSinceLastActivity} days since activity)`);
        }

        // OPTIMIZED: Batch create notifications for all stall warnings
        const notificationsToCreate = updates
          .filter(u => u.shouldNotify)
          .map(u => ({
            userId: u.userId,
            type: 'stall_warning',
            message: `Your participation status changed to: ${u.newStallStage}. Submit activity to improve your standing.`,
            metadata: JSON.stringify({ 
              cycleId: cycle.id, 
              stallStage: u.newStallStage,
              previousStage: u.oldStallStage,
              daysSinceLastActivity: u.daysSinceLastActivity
            })
          }));

        if (notificationsToCreate.length > 0) {
          await prisma.notification.createMany({ data: notificationsToCreate });
          console.log(`Created ${notificationsToCreate.length} stall warning notifications for cycle ${cycle.id}`);

          // Send stall warning emails — batch user lookup to avoid N+1
          const usersToEmail = updates.filter(u => u.shouldNotify);
          const userIds = usersToEmail.map(u => u.userId);
          const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true, profile: { select: { notificationPrefs: true } } },
          });
          const userMap = new Map(users.map(u => [u.id, u]));

          for (const u of usersToEmail) {
            const user = userMap.get(u.userId);
            if (!user) continue;
            const prefs = user.profile?.notificationPrefs
              ? JSON.parse(user.profile.notificationPrefs)
              : { stallWarnings: true };
            if (!prefs.stallWarnings) continue;

            triggerEmail('STALL_WARNING', {
              email: user.email,
              name: user.name,
              stallStage: u.newStallStage,
              cycleId: cycle.id,
              daysSinceLastActivity: u.daysSinceLastActivity,
              timestamp: new Date().toISOString(),
            } as Parameters<typeof triggerEmail>[1] & { stallStage: string; cycleId: string; daysSinceLastActivity: number }).catch(() => {});
          }
        }

        console.log(`Processed ${cycle.participations.length} participants in cycle ${cycle.id}, updated ${participantsToUpdate.length}`);
      }

      console.log('Stall evaluator job completed successfully');
    } catch (error) {
      console.error('Error in stall evaluator job:', error);
      throw error;
    }
  }

  private static calculateDaysSinceLastActivity(lastActivityDate: Date | null, createdAt: Date): number {
    if (!lastActivityDate) {
      // Calculate days since participation started (grace period)
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastActivityDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  private static determineStallStage(daysSinceLastActivity: number, daysSinceJoined: number): string {
    // Grace period: 3 days from joining
    if (daysSinceJoined <= 3) {
      return 'grace';
    }

    // After grace period, use normal stall evaluation
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