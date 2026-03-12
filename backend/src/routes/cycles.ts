import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const createCycleSchema = z.object({
  name: z.string().min(1, "Cycle name is required"),
  description: z.string().optional(),
  startDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, "Invalid start date format"),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, "Invalid end date format"),
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "End date must be after start date",
  path: ["endDate"]
});

const updateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  state: z.enum(['planned', 'active', 'paused', 'closed']).optional(),
  startDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, "Invalid start date format").optional(),
  endDate: z.string().refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, "Invalid end date format").optional(),
});

// Get all cycles
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    console.log('📋 Fetching all cycles');

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

    console.log('✅ Cycles fetched:', { count: cyclesWithCount.length });

    res.json({
      success: true,
      data: cyclesWithCount,
      error: null
    });
  } catch (error) {
    console.error('❌ Error fetching cycles:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch cycles'
    });
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
    console.log('🚀 Creating cycle:', {
      userId: req.user?.id,
      body: req.body
    });

    const validatedData = createCycleSchema.parse(req.body);
    const { name, description, startDate, endDate } = validatedData;

    // Parse dates (validation already done by schema)
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    console.log('📅 Parsed dates:', {
      startDate,
      endDate,
      startParsed: start.toISOString(),
      endParsed: end.toISOString()
    });

    // Check for duplicate names
    const existingCycle = await prisma.buildCycle.findFirst({
      where: { name }
    });

    if (existingCycle) {
      console.log('❌ Cycle name already exists:', name);
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Cycle name already exists'
      });
    }

    const cycle = await prisma.buildCycle.create({
      data: {
        name,
        description: description || null,
        state: 'planned',
        startDate: start,
        endDate: end,
      }
    });

    console.log('✅ Cycle created successfully:', {
      cycleId: cycle.id,
      name: cycle.name
    });

    res.status(201).json({
      success: true,
      data: cycle,
      error: null
    });
  } catch (error) {
    console.error('❌ Error creating cycle:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
      });
    }
    
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to create cycle'
    });
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