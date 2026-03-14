import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const sessionHeartbeatSchema = z.object({
  pageVisited: z.string(),
  timestamp: z.string().optional(),
});

const sessionStartSchema = z.object({
  pageVisited: z.string().default('/'),
});

// Start a new session
router.post('/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pageVisited } = sessionStartSchema.parse(req.body);

    // Close any existing active sessions for this user
    await prisma.userActivitySession.updateMany({
      where: {
        userId: req.user!.id,
        sessionEnd: null,
      },
      data: {
        sessionEnd: new Date(),
        durationMinutes: 0, // Will be calculated properly on heartbeat
      },
    });

    // Create new session
    const session = await prisma.userActivitySession.create({
      data: {
        userId: req.user!.id,
        sessionStart: new Date(),
        pageVisited,
        lastHeartbeat: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: { sessionId: session.id },
      error: null,
    });
  } catch (error) {
    console.error('Error starting session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
      });
    }
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to start session',
    });
  }
});

// Send heartbeat to keep session alive
router.post('/heartbeat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pageVisited } = sessionHeartbeatSchema.parse(req.body);

    // Find the most recent active session
    const activeSession = await prisma.userActivitySession.findFirst({
      where: {
        userId: req.user!.id,
        sessionEnd: null,
      },
      orderBy: { sessionStart: 'desc' },
    });

    if (!activeSession) {
      // No active session, create one
      const session = await prisma.userActivitySession.create({
        data: {
          userId: req.user!.id,
          sessionStart: new Date(),
          pageVisited,
          lastHeartbeat: new Date(),
        },
      });

      return res.json({
        success: true,
        data: { sessionId: session.id, created: true },
        error: null,
      });
    }

    // Update existing session
    const now = new Date();
    const durationMinutes = Math.floor(
      (now.getTime() - activeSession.sessionStart.getTime()) / (1000 * 60)
    );

    await prisma.userActivitySession.update({
      where: { id: activeSession.id },
      data: {
        lastHeartbeat: now,
        pageVisited,
        durationMinutes,
      },
    });

    res.json({
      success: true,
      data: { sessionId: activeSession.id, updated: true },
      error: null,
    });
  } catch (error) {
    console.error('Error updating session heartbeat:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`,
      });
    }
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to update session',
    });
  }
});

// End current session
router.post('/end', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Find and close active sessions
    const activeSessions = await prisma.userActivitySession.findMany({
      where: {
        userId: req.user!.id,
        sessionEnd: null,
      },
    });

    const now = new Date();
    
    for (const session of activeSessions) {
      const durationMinutes = Math.floor(
        (now.getTime() - session.sessionStart.getTime()) / (1000 * 60)
      );

      await prisma.userActivitySession.update({
        where: { id: session.id },
        data: {
          sessionEnd: now,
          durationMinutes,
        },
      });
    }

    res.json({
      success: true,
      data: { closedSessions: activeSessions.length },
      error: null,
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to end session',
    });
  }
});

// Get user session analytics
router.get('/analytics', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const sessions = await prisma.userActivitySession.findMany({
      where: {
        userId: req.user!.id,
        sessionStart: {
          gte: startDate,
        },
      },
      orderBy: { sessionStart: 'desc' },
    });

    // Calculate analytics
    const totalSessions = sessions.length;
    const totalMinutes = sessions.reduce((sum: number, session) => sum + (session.durationMinutes || 0), 0);
    const avgSessionLength = totalSessions > 0 ? totalMinutes / totalSessions : 0;
    
    // Group by day for heatmap data
    const dailyActivity = sessions.reduce((acc: Record<string, { date: string; sessions: number; totalMinutes: number; pages: Set<string> }>, session) => {
      const date = session.sessionStart.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          sessions: 0,
          totalMinutes: 0,
          pages: new Set(),
        };
      }
      acc[date].sessions++;
      acc[date].totalMinutes += session.durationMinutes || 0;
      acc[date].pages.add(session.pageVisited);
      return acc;
    }, {});

    // Convert to array and add page count
    const dailyData = Object.values(dailyActivity).map((day) => ({
      ...day,
      uniquePages: day.pages.size,
      pages: undefined, // Remove Set from response
    }));

    res.json({
      success: true,
      data: {
        totalSessions,
        totalMinutes,
        avgSessionLength: Math.round(avgSessionLength),
        dailyActivity: dailyData,
        period: `${daysNum} days`,
      },
      error: null,
    });
  } catch (error) {
    console.error('Error fetching session analytics:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch session analytics',
    });
  }
});

// Get all user sessions (admin only)
router.get('/all', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { days = '7' } = req.query;
    const daysNum = parseInt(days as string, 10);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    const sessions = await prisma.userActivitySession.findMany({
      where: {
        sessionStart: {
          gte: startDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { sessionStart: 'desc' },
    });

    // Calculate summary stats
    const userStats = sessions.reduce((acc: Record<string, { user: { id: string; email: string; name: string | null }; totalSessions: number; totalMinutes: number; lastActive: Date }>, session) => {
      const userId = session.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: session.user,
          totalSessions: 0,
          totalMinutes: 0,
          lastActive: session.sessionStart,
        };
      }
      acc[userId].totalSessions++;
      acc[userId].totalMinutes += session.durationMinutes || 0;
      if (session.sessionStart > acc[userId].lastActive) {
        acc[userId].lastActive = session.sessionStart;
      }
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        sessions,
        userStats: Object.values(userStats),
        period: `${daysNum} days`,
      },
      error: null,
    });
  } catch (error) {
    console.error('Error fetching all sessions:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch sessions',
    });
  }
});

export default router;