import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get audit logs (admin only)
router.get('/audit', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const auditLogs = await prisma.auditTrail.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        targetUser: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    res.json(auditLogs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resolve dispute (admin only)
router.post('/resolve-dispute', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      disputeId: z.string(),
      status: z.enum(['approved', 'denied']),
      resolution: z.string()
    });

    const { disputeId, status, resolution } = schema.parse(req.body);

    // Update dispute
    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution,
        resolvedAt: new Date(),
        resolvedBy: req.user!.id
      }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'dispute_resolution',
        targetUserId: dispute.userId,
        previousValue: JSON.stringify({ status: 'pending' }),
        newValue: JSON.stringify({ status, resolution }),
        reason: `Dispute resolved: ${resolution}`,
        timestamp: new Date()
      }
    });

    res.json({ message: 'Dispute resolved successfully', dispute });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin stats (admin only)
router.get('/stats', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const [userCount, cycleCount, activityCount, participationCount] = await Promise.all([
      prisma.user.count(),
      prisma.buildCycle.count(),
      prisma.activityEvent.count(),
      prisma.cycleParticipation.count({ where: { optedIn: true } })
    ]);

    res.json({
      userCount,
      cycleCount,
      activityCount,
      participationCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        profile: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user role (admin only)
router.patch('/users/:id/role', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      role: z.enum(['founder', 'admin', 'contributor', 'employee', 'observer'])
    });

    const { role } = schema.parse(req.body);
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: { role }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'role_change',
        targetUserId: userId,
        previousValue: JSON.stringify({ role: 'previous_role' }),
        newValue: JSON.stringify({ role }),
        reason: `Role changed to ${role}`,
        timestamp: new Date()
      }
    });

    res.json({ message: 'User role updated successfully', profile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;