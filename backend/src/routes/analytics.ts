import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get dashboard analytics
router.get('/dashboard', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cycleId } = req.query;
    
    // Build where clause for cycle filtering
    const whereClause = cycleId ? { cycleId: cycleId as string } : {};

    // Get activity statistics
    const [
      totalActivities,
      verifiedActivities,
      pendingActivities,
      rejectedActivities
    ] = await Promise.all([
      prisma.activityEvent.count({ where: whereClause }),
      prisma.activityEvent.count({ where: { ...whereClause, status: 'verified' } }),
      prisma.activityEvent.count({ where: { ...whereClause, status: 'pending' } }),
      prisma.activityEvent.count({ where: { ...whereClause, status: 'rejected' } })
    ]);

    // Get participation health (calculate stall stages based on last activity)
    const participations = await prisma.cycleParticipation.findMany({
      where: cycleId ? { cycleId: cycleId as string } : {},
      include: {
        user: {
          include: {
            activityEvents: {
              where: cycleId ? { cycleId: cycleId as string } : {},
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    const now = new Date();
    const participationHealth = {
      active: 0,
      atRisk: 0,
      diminishing: 0,
      paused: 0
    };

    participations.forEach(participation => {
      const lastActivity = participation.user.activityEvents[0];
      if (!lastActivity) {
        participationHealth.paused++;
        return;
      }

      const daysSinceLastActivity = Math.floor(
        (now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastActivity <= 6) {
        participationHealth.active++;
      } else if (daysSinceLastActivity <= 13) {
        participationHealth.atRisk++;
      } else if (daysSinceLastActivity <= 20) {
        participationHealth.diminishing++;
      } else {
        participationHealth.paused++;
      }
    });

    // Calculate additional metrics
    const uniqueUsers = await prisma.activityEvent.findMany({
      where: whereClause,
      select: { userId: true },
      distinct: ['userId']
    });

    const avgFrequency = uniqueUsers.length > 0 ? totalActivities / uniqueUsers.length : 0;

    // Count inactive users (no activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUserIds = await prisma.activityEvent.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: sevenDaysAgo }
      },
      select: { userId: true },
      distinct: ['userId']
    });

    const totalUsers = participations.length;
    const inactiveUsers = totalUsers - activeUserIds.length;

    res.json({
      totalActivities,
      verifiedActivities,
      pendingActivities,
      rejectedActivities,
      participationHealth,
      totalSubmissions: totalActivities, // Same as totalActivities
      avgFrequency: Math.round(avgFrequency * 100) / 100, // Round to 2 decimal places
      inactiveUsers,
      totalUsers,
      activeUsers: activeUserIds.length
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get cycle-specific analytics
router.get('/cycle/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId;

    // Get cycle details
    const cycle = await prisma.buildCycle.findUnique({
      where: { id: cycleId },
      include: {
        participations: {
          include: {
            user: {
              include: {
                activityEvents: {
                  where: { cycleId },
                  orderBy: { createdAt: 'desc' },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    // Calculate cycle progress
    const now = new Date();
    const startDate = new Date(cycle.startDate);
    const endDate = new Date(cycle.endDate);
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

    // Calculate current stage based on last activity
    const participantCount = cycle.participations.length;
    let lastActivityDate = null;
    
    if (cycle.participations.length > 0) {
      const allLastActivities = cycle.participations
        .map(p => p.user.activityEvents[0]?.createdAt)
        .filter(Boolean)
        .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
      
      lastActivityDate = allLastActivities[0] || null;
    }

    let currentStage = 'paused';
    if (lastActivityDate) {
      const daysSinceLastActivity = Math.floor(
        (now.getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastActivity <= 6) {
        currentStage = 'active';
      } else if (daysSinceLastActivity <= 13) {
        currentStage = 'at_risk';
      } else if (daysSinceLastActivity <= 20) {
        currentStage = 'diminishing';
      } else {
        currentStage = 'paused';
      }
    }

    res.json({
      cycleId,
      cycleName: cycle.name,
      participantCount,
      currentStage,
      lastActivityDate,
      progress: Math.round(progress * 100) / 100,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      state: cycle.state
    });

  } catch (error) {
    console.error('Cycle analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch cycle analytics' });
  }
});

export default router;