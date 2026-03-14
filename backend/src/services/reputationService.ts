import { prisma } from '../config/database';

export class ReputationService {
  static async calculateUserReputation(userId: string): Promise<number> {
    try {
      // OPTIMIZED: Use groupBy to get activity stats by status in one query
      const activityStats = await prisma.activityEvent.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
        _sum: { hoursLogged: true }
      });

      // OPTIMIZED: Get cycle count and last activity in parallel
      const [cycleCount, lastActivity] = await Promise.all([
        prisma.cycleParticipation.count({ where: { userId, optedIn: true } }),
        prisma.activityEvent.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        })
      ]);

      // Process results efficiently
      const verifiedStats = activityStats.find(s => s.status === 'verified');
      const rejectedStats = activityStats.find(s => s.status === 'rejected');

      const verifiedActivities = verifiedStats?._count || 0;
      const rejectedActivities = rejectedStats?._count || 0;
      const totalHoursLogged = verifiedStats?._sum.hoursLogged || 0;
      const activeCycles = cycleCount;

      // Calculate consistency score (activities per cycle)
      const consistencyScore = activeCycles > 0 ? verifiedActivities / activeCycles : 0;

      // Calculate reputation score
      const reputationScore = Math.max(0,
        (verifiedActivities * 5) +
        (activeCycles * 10) -
        (rejectedActivities * 3) +
        (consistencyScore * 8) +
        (Math.min(totalHoursLogged / 10, 20)) // Cap hours bonus at 20 points
      );

      // Update or create reputation record
      await prisma.contributorReputation.upsert({
        where: { userId },
        update: {
          reputationScore,
          verifiedActivities,
          rejectedActivities,
          activeCycles,
          consistencyScore,
          totalHoursLogged,
          lastActivityDate: lastActivity?.createdAt,
          updatedAt: new Date()
        },
        create: {
          userId,
          reputationScore,
          verifiedActivities,
          rejectedActivities,
          activeCycles,
          consistencyScore,
          totalHoursLogged,
          lastActivityDate: lastActivity?.createdAt
        }
      });

      return reputationScore;
    } catch (error) {
      console.error('Error calculating reputation:', error);
      return 0;
    }
  }

  static async updateCycleEngagement(cycleId: string): Promise<void> {
    try {
      const [
        activityCount,
        verifiedActivities,
        participantCount,
        activeParticipants,
        messageCount,
        totalHours
      ] = await Promise.all([
        prisma.activityEvent.count({ where: { cycleId } }),
        prisma.activityEvent.count({ where: { cycleId, status: 'verified' } }),
        prisma.cycleParticipation.count({ where: { cycleId, optedIn: true } }),
        prisma.cycleParticipation.count({ where: { cycleId, stallStage: 'active' } }),
        prisma.cycleMessage.count({ where: { cycleId } }),
        prisma.activityEvent.aggregate({
          where: { cycleId, status: 'verified' },
          _sum: { hoursLogged: true }
        })
      ]);

      const participationRate = participantCount > 0 ? activeParticipants / participantCount : 0;
      const verifiedActivityRatio = activityCount > 0 ? verifiedActivities / activityCount : 0;
      const averageHoursPerUser = participantCount > 0 ? (totalHours._sum.hoursLogged || 0) / participantCount : 0;

      // Calculate engagement score (0-100)
      const engagementScore = Math.min(100,
        (activityCount * 0.5) +
        (participationRate * 30) +
        (verifiedActivityRatio * 20) +
        (messageCount * 0.1) +
        (averageHoursPerUser * 2)
      );

      await prisma.cycleEngagement.upsert({
        where: { cycleId },
        update: {
          engagementScore,
          activityCount,
          participationRate,
          verifiedActivityRatio,
          averageHoursPerUser,
          messageCount,
          updatedAt: new Date()
        },
        create: {
          cycleId,
          engagementScore,
          activityCount,
          participationRate,
          verifiedActivityRatio,
          averageHoursPerUser,
          messageCount
        }
      });
    } catch (error) {
      console.error('Error updating cycle engagement:', error);
    }
  }

  static async getTopContributors(limit: number = 10) {
    try {
      return await prisma.contributorReputation.findMany({
        take: limit,
        orderBy: { reputationScore: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: {
                select: {
                  avatar: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching top contributors:', error);
      return [];
    }
  }

  static async getCycleEngagement(cycleId: string) {
    try {
      return await prisma.cycleEngagement.findUnique({
        where: { cycleId },
        include: {
          cycle: {
            select: {
              name: true,
              state: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching cycle engagement:', error);
      return null;
    }
  }
}