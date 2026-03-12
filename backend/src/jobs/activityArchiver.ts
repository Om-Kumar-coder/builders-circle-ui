import { prisma } from '../config/database';

export class ActivityArchiverJob {
  static async run() {
    console.log('Running activity archiver job...');

    try {
      // Archive activities from closed cycles that are older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get activities from closed cycles older than 30 days
      const activitiesToArchive = await prisma.activityEvent.findMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo
          },
          cycle: {
            state: 'closed'
          }
        },
        take: 100 // Process in batches
      });

      for (const activity of activitiesToArchive) {
        // Create archived copy
        await prisma.archivedActivity.create({
          data: {
            userId: activity.userId,
            cycleId: activity.cycleId,
            activityType: activity.activityType,
            proofLink: activity.proofLink,
            description: activity.description,
            verified: activity.status === 'verified' ? 'yes' : 'no',
            contributionType: activity.contributionType,
            contributionWeight: activity.contributionWeight,
            calculatedOwnership: activity.calculatedOwnership,
            originalId: activity.id
          }
        });

        // Delete original activity
        await prisma.activityEvent.delete({
          where: { id: activity.id }
        });

        console.log(`Archived activity ${activity.id}`);
      }

      console.log(`Activity archiver job completed. Archived ${activitiesToArchive.length} activities.`);
    } catch (error) {
      console.error('Error in activity archiver job:', error);
      throw error;
    }
  }
}