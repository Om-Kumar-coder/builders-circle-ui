import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const joinCycleSchema = z.object({
  cycleId: z.string(),
});

// Join a cycle
router.post('/join', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cycleId } = joinCycleSchema.parse(req.body);

    // Check if cycle exists and is active
    const cycle = await prisma.buildCycle.findUnique({
      where: { id: cycleId }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    if (cycle.state !== 'active') {
      return res.status(400).json({ error: 'Cycle is not active' });
    }

    // Check if already participating
    const existingParticipation = await prisma.cycleParticipation.findUnique({
      where: {
        userId_cycleId: {
          userId: req.user!.id,
          cycleId
        }
      }
    });

    if (existingParticipation) {
      return res.status(400).json({ error: 'Already participating in this cycle' });
    }

    // Create participation
    const participation = await prisma.cycleParticipation.create({
      data: {
        userId: req.user!.id,
        cycleId,
        optedIn: true,
        participationStatus: 'grace',
        stallStage: 'grace'
      }
    });

    res.status(201).json(participation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get participation for a cycle
router.get('/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participation = await prisma.cycleParticipation.findUnique({
      where: {
        userId_cycleId: {
          userId: req.user!.id,
          cycleId: Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId
        }
      },
      include: {
        cycle: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!participation) {
      return res.status(404).json({ error: 'Participation not found' });
    }

    res.json(participation);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update participation
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const updateData = z.object({
      optedIn: z.boolean().optional(),
    }).parse(req.body);

    const participationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const participation = await prisma.cycleParticipation.update({
      where: { 
        id: participationId,
        userId: req.user!.id // Ensure user can only update their own participation
      },
      data: updateData
    });

    res.json(participation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all participants in a cycle (admin only)
router.get('/:cycleId/all', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId;

    const participants = await prisma.cycleParticipation.findMany({
      where: { cycleId },
      include: {
        user: {
          include: {
            profile: true,
            activityEvents: {
              where: { cycleId },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate stall stages based on last activity
    const now = new Date();
    const participantsWithStallStage = participants.map(participation => {
      const lastActivity = participation.user.activityEvents[0];
      let calculatedStallStage = 'paused';
      
      if (lastActivity) {
        const daysSinceLastActivity = Math.floor(
          (now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastActivity <= 6) {
          calculatedStallStage = 'active';
        } else if (daysSinceLastActivity <= 13) {
          calculatedStallStage = 'at_risk';
        } else if (daysSinceLastActivity <= 20) {
          calculatedStallStage = 'diminishing';
        } else {
          calculatedStallStage = 'paused';
        }
      }

      return {
        ...participation,
        calculatedStallStage,
        lastActivityDate: lastActivity?.createdAt || null
      };
    });

    res.json(participantsWithStallStage);
  } catch (error) {
    console.error('Participants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;