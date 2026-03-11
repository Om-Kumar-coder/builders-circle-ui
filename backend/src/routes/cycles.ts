import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const createCycleSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const updateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  state: z.enum(['planned', 'active', 'paused', 'closed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Get all cycles
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const cycles = await prisma.buildCycle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { participations: true }
        }
      }
    });

    const cyclesWithCount = cycles.map((cycle: any) => ({
      ...cycle,
      participantCount: cycle._count.participations
    }));

    res.json(cyclesWithCount);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single cycle
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const cycle = await prisma.buildCycle.findUnique({
      where: { id: cycleId },
      include: {
        _count: {
          select: { participations: true }
        }
      }
    });

    if (!cycle) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    res.json({
      ...cycle,
      participantCount: (cycle as any)._count.participations
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create cycle (admin only)
router.post('/', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, startDate, endDate } = createCycleSchema.parse(req.body);

    const cycle = await prisma.buildCycle.create({
      data: {
        name,
        state: 'planned',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      }
    });

    res.status(201).json(cycle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update cycle (admin only)
router.patch('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: Request, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updateData = updateCycleSchema.parse(req.body);
    
    const cycle = await prisma.buildCycle.update({
      where: { id: cycleId },
      data: {
        ...updateData,
        startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
      }
    });

    res.json(cycle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete cycle (admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: Request, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    await prisma.buildCycle.delete({
      where: { id: cycleId }
    });

    res.json({ message: 'Cycle deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;