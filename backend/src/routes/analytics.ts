import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { ReputationService } from '../services/reputationService';

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
    // OPTIMIZED: Only select needed fields instead of loading full user objects
    const participations = await prisma.cycleParticipation.findMany({
      where: cycleId ? { cycleId: cycleId as string } : {},
      select: { userId: true, cycleId: true, createdAt: true }
    });

    // OPTIMIZED: Get last activity per user in one query instead of N queries
    const lastActivities = await prisma.activityEvent.findMany({
      where: cycleId ? { cycleId: cycleId as string } : {},
      distinct: ['userId'],
      orderBy: { createdAt: 'desc' },
      select: { userId: true, createdAt: true }
    });

    // OPTIMIZED: Create lookup map for O(1) access instead of nested loops
    const lastActivityByUser = new Map(
      lastActivities.map(a => [a.userId, a.createdAt])
    );

    const now = new Date();
    const participationHealth = {
      active: 0,
      atRisk: 0,
      diminishing: 0,
      paused: 0
    };

    participations.forEach(participation => {
      const lastActivity = lastActivityByUser.get(participation.userId);
      if (!lastActivity) {
        participationHealth.paused++;
        return;
      }

      const daysSinceLastActivity = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
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
    // OPTIMIZED: Use lastActivities array instead of separate query
    const uniqueUsers = lastActivities.length;
    const avgFrequency = uniqueUsers > 0 ? totalActivities / uniqueUsers : 0;

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
      success: true,
      data: {
        totalActivities,
        verifiedActivities,
        pendingActivities,
        rejectedActivities,
        participationHealth,
        totalSubmissions: totalActivities,
        avgFrequency: Math.round(avgFrequency * 100) / 100,
        inactiveUsers,
        totalUsers,
        activeUsers: activeUserIds.length
      },
      error: null
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch analytics' });
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
      return res.status(404).json({ success: false, data: null, error: 'Cycle not found' });
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

    // Fetch activity counts and hours for this cycle
    const [
      totalActivities,
      verifiedActivities,
      pendingActivities,
      hoursResult
    ] = await Promise.all([
      prisma.activityEvent.count({ where: { cycleId } }),
      prisma.activityEvent.count({ where: { cycleId, status: 'verified' } }),
      prisma.activityEvent.count({ where: { cycleId, status: 'pending' } }),
      prisma.activityEvent.aggregate({
        where: { cycleId },
        _sum: { hoursLogged: true }
      })
    ]);

    const totalHours = hoursResult._sum.hoursLogged ?? 0;
    const averageHoursPerUser = participantCount > 0 ? totalHours / participantCount : 0;

    res.json({
      success: true,
      data: {
        cycleId,
        cycleName: cycle.name,
        participantCount,
        currentStage,
        lastActivityDate,
        progress: Math.round(progress * 100) / 100,
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        state: cycle.state,
        totalActivities,
        verifiedActivities,
        pendingActivities,
        totalHours: Math.round(totalHours * 10) / 10,
        averageHoursPerUser: Math.round(averageHoursPerUser * 10) / 10,
      },
      error: null
    });

  } catch (error) {
    console.error('Cycle analytics error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch cycle analytics' });
  }
});

// Get contributor analytics
router.get('/contributors', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    
    const topContributors = await ReputationService.getTopContributors(Number(limit));
    
    res.json({
      success: true,
      data: topContributors,
      error: null
    });
  } catch (error) {
    console.error('Contributors analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch contributor analytics' });
  }
});

// Get user reputation
router.get('/reputation/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    
    // Users can only view their own reputation unless they're admin
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'founder';
    if (!isAdmin && userId !== req.user!.id) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied' });
    }

    const db = prisma as unknown as Record<string, { findUnique: (args: unknown) => Promise<unknown> }>;
    const reputation = await db.contributorReputation.findUnique({
      where: { userId },
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

    if (!reputation) {
      // Calculate reputation if it doesn't exist
      await ReputationService.calculateUserReputation(userId);
      const newReputation = await db.contributorReputation.findUnique({
        where: { userId },
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
      return res.json({ success: true, data: newReputation, error: null });
    }

    res.json({ success: true, data: reputation, error: null });
  } catch (error) {
    console.error('Reputation analytics error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch reputation' });
  }
});

// Get cycle engagement
router.get('/engagement/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId;
    
    const engagement = await ReputationService.getCycleEngagement(cycleId);
    
    if (!engagement) {
      // Calculate engagement if it doesn't exist
      await ReputationService.updateCycleEngagement(cycleId);
      const newEngagement = await ReputationService.getCycleEngagement(cycleId);
      return res.json({ success: true, data: newEngagement, error: null });
    }

    res.json({ success: true, data: engagement, error: null });
  } catch (error) {
    console.error('Engagement analytics error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch cycle engagement' });
  }
});

// Get participation insights
router.get('/participation-insights', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { cycleId } = req.query;
    
    const whereClause = cycleId ? { cycleId: cycleId as string } : {};

    // Get detailed participation breakdown with user data
    const participations = await (prisma.cycleParticipation.findMany as (args: unknown) => Promise<Record<string, unknown>[]>)({
      where: whereClause,
      include: {
        user: {
          include: {
            activityEvents: {
              where: cycleId ? { cycleId: cycleId as string } : {},
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            reputation: true
          }
        }
      }
    }) as Record<string, unknown>[];

    const now = new Date();
    const insights = {
      activeParticipants: 0,
      atRiskParticipants: 0,
      pausedParticipants: 0,
      participantsInGrace: 0,
      averageReputation: 0,
      topPerformers: [] as Array<{ id: string; name: string | null; email: string; reputation: number; lastActivity: Date | undefined; stallStage: string }>,
      strugglingUsers: [] as Array<{ id: string; name: string | null; email: string; reputation: number; lastActivity: Date | undefined; stallStage: string }>
    };

    let totalReputation = 0;
    let reputationCount = 0;

    participations.forEach(participation => {
      const lastActivity = participation.user.activityEvents[0];
      const daysSinceLastActivity = lastActivity 
        ? Math.floor((now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Categorize participants
      if (daysSinceLastActivity <= 6) {
        insights.activeParticipants++;
      } else if (daysSinceLastActivity <= 13) {
        insights.atRiskParticipants++;
      } else if (daysSinceLastActivity <= 20) {
        insights.participantsInGrace++;
      } else {
        insights.pausedParticipants++;
      }

      // Calculate reputation stats
      const rep = participation.user.reputation;
      if (rep) {
        totalReputation += rep.reputationScore;
        reputationCount++;

        const userInfo = {
          id: participation.user.id,
          name: participation.user.name,
          email: participation.user.email,
          reputation: rep.reputationScore,
          lastActivity: lastActivity?.createdAt,
          stallStage: participation.stallStage
        };

        // Top performers (reputation > 50 and active)
        if (rep.reputationScore > 50 && daysSinceLastActivity <= 6) {
          insights.topPerformers.push(userInfo);
        }

        // Struggling users (low reputation or inactive)
        if (rep.reputationScore < 20 || daysSinceLastActivity > 13) {
          insights.strugglingUsers.push(userInfo);
        }
      }
    });

    insights.averageReputation = reputationCount > 0 ? totalReputation / reputationCount : 0;
    insights.topPerformers.sort((a, b) => b.reputation - a.reputation);
    insights.topPerformers = insights.topPerformers.slice(0, 10);
    insights.strugglingUsers.sort((a, b) => a.reputation - b.reputation);
    insights.strugglingUsers = insights.strugglingUsers.slice(0, 10);

    res.json({
      success: true,
      data: insights,
      error: null
    });
  } catch (error) {
    console.error('Participation insights error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch participation insights' });
  }
});

export default router;