"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityArchiverJob = void 0;
const database_1 = require("../config/database");
class ActivityArchiverJob {
    static async run() {
        console.log('Running activity archiver job...');
        try {
            // Archive activities from closed cycles that are older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            // Get activities from closed cycles older than 30 days
            const activitiesToArchive = await database_1.prisma.activityEvent.findMany({
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
                await database_1.prisma.archivedActivity.create({
                    data: {
                        userId: activity.userId,
                        cycleId: activity.cycleId,
                        activityType: activity.activityType,
                        proofLink: activity.proofLink,
                        description: activity.description,
                        verified: activity.verified,
                        contributionType: activity.contributionType,
                        contributionWeight: activity.contributionWeight,
                        calculatedOwnership: activity.calculatedOwnership,
                        originalId: activity.id
                    }
                });
                // Delete original activity
                await database_1.prisma.activityEvent.delete({
                    where: { id: activity.id }
                });
                console.log(`Archived activity ${activity.id}`);
            }
            console.log(`Activity archiver job completed. Archived ${activitiesToArchive.length} activities.`);
        }
        catch (error) {
            console.error('Error in activity archiver job:', error);
            throw error;
        }
    }
}
exports.ActivityArchiverJob = ActivityArchiverJob;
//# sourceMappingURL=activityArchiver.js.map