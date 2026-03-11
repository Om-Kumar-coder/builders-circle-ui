import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const createActivitySchema = z.object({
  cycleId: z.string(),
  activityType: z.string(),
  proofLink: z.string().url(),
  description: z.string().optional(),
  contributionType: z.enum(['code', 'documentation', 'review', 'hours_logged']).default('code'),
  contributionWeight: z.number().min(0).max(10).default(1.0),
});

const updateActivitySchema = z.object({
  verified: z.enum(['pending', 'verified', 'rejected']).optional(),
  calculatedOwnership: z.number().optional(),
});

// Get activities
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cycleId, userId } = req.query;

    const where: any = {};
    
    if (cycleId) where.cycleId = cycleId as string;
    if (userId) where.userId = userId as string;
    
    // If no specific user requested, show only current user's activities
    if (!userId) where.userId = req.user!.id;

    const activities = await prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        }
      }
    });

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create activity
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = createActivitySchema.parse(req.body);

    // Check if cycle exists and is active
    const cycle = await prisma.buildCycle.findUnique({
      where: { id: data.cycleId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    if (cycle.state !== 'active') {
      return res.status(400).json({ error: 'Cycle is not active' });
    }

    // Check if user is participating in the cycle
    const participation = await prisma.cycleParticipation.findUnique({
      where: {
        userId_cycleId: {
          userId: req.user!.id,
          cycleId: data.cycleId
        }
      }
    });

    if (!participation || !participation.optedIn) {
      return res.status(400).json({ error: 'Must be participating in cycle to submit activities' });
    }

    // Create activity
    const activity = await prisma.activityEvent.create({
      data: {
        userId: req.user!.id,
        cycleId: data.cycleId,
        activityType: data.activityType,
        proofLink: data.proofLink,
        description: data.description,
        contributionType: data.contributionType,
        contributionWeight: data.contributionWeight,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        }
      }
    });

    // Update participation's lastActivityDate and reset stall stage
    await prisma.cycleParticipation.update({
      where: {
        userId_cycleId: {
          userId: req.user!.id,
          cycleId: data.cycleId
        }
      },
      data: {
        lastActivityDate: new Date(),
        stallStage: 'active',
        participationStatus: 'active'
      }
    });

    res.status(201).json(activity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update activity (admin only for verification)
router.patch('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updateData = updateActivitySchema.parse(req.body);

    const activity = await prisma.activityEvent.update({
      where: { id: activityId },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        }
      }
    });

    // If activity was verified, create ownership ledger entry
    if (updateData.verified === 'verified' && updateData.calculatedOwnership) {
      await prisma.ownershipLedger.create({
        data: {
          userId: activity.userId,
          cycleId: activity.cycleId,
          eventType: 'activity_verified',
          ownershipAmount: updateData.calculatedOwnership,
          multiplierSnapshot: 1.0, // Will be updated by multiplier system
          sourceReference: activity.id,
          createdBy: req.user!.id
        }
      });
    }

    res.json(activity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete activity (admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    await prisma.activityEvent.delete({
      where: { id: activityId }
    });

    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;