import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const updateWeightSchema = z.object({
  contributionType: z.enum(['code', 'documentation', 'review', 'hours_logged', 'meeting', 'research', 'task_completion']),
  weight: z.number().min(0).max(10),
  description: z.string().optional(),
});

const createWeightSchema = z.object({
  contributionType: z.enum(['code', 'documentation', 'review', 'hours_logged', 'meeting', 'research', 'task_completion']),
  weight: z.number().min(0).max(10),
  description: z.string().optional(),
});

// Default weights
const DEFAULT_WEIGHTS = {
  code: 1.0,
  documentation: 0.6,
  review: 0.5,
  hours_logged: 0.4,
  research: 0.5,
  meeting: 0.2,
  task_completion: 0.8,
};

// Initialize default weights if they don't exist
async function initializeDefaultWeights() {
  for (const [type, weight] of Object.entries(DEFAULT_WEIGHTS)) {
    const existing = await prisma.contributionWeight.findUnique({
      where: { contributionType: type },
    });

    if (!existing) {
      await prisma.contributionWeight.create({
        data: {
          contributionType: type,
          weight,
          description: `Default weight for ${type} contributions`,
        },
      });
    }
  }
}

// Get all contribution weights
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Initialize defaults if needed
    await initializeDefaultWeights();

    const weights = await prisma.contributionWeight.findMany({
      orderBy: { contributionType: 'asc' },
    });

    res.json({
      success: true,
      data: weights,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching contribution weights:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch contribution weights',
    });
  }
});

// Get weight for specific contribution type
router.get('/:type', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contributionType = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;

    let weight = await prisma.contributionWeight.findUnique({
      where: { contributionType },
    });

    // If not found, create with default value
    if (!weight && DEFAULT_WEIGHTS[contributionType as keyof typeof DEFAULT_WEIGHTS]) {
      weight = await prisma.contributionWeight.create({
        data: {
          contributionType,
          weight: DEFAULT_WEIGHTS[contributionType as keyof typeof DEFAULT_WEIGHTS],
          description: `Default weight for ${contributionType} contributions`,
        },
      });
    }

    if (!weight) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Contribution type not found',
      });
    }

    res.json({
      success: true,
      data: weight,
      error: null,
    });
  } catch (error) {
    console.error('Error fetching contribution weight:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch contribution weight',
    });
  }
});

// Update contribution weight (admin only)
router.patch('/:type', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const contributionType = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
    const { weight, description } = updateWeightSchema.parse({
      contributionType,
      ...req.body,
    });

    const updatedWeight = await prisma.contributionWeight.upsert({
      where: { contributionType },
      update: {
        weight,
        description,
        updatedBy: req.user!.id,
      },
      create: {
        contributionType,
        weight,
        description,
        updatedBy: req.user!.id,
      },
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'weight_update',
        targetUserId: req.user!.id, // Self-reference for system changes
        previousValue: JSON.stringify({ contributionType, weight: DEFAULT_WEIGHTS[contributionType as keyof typeof DEFAULT_WEIGHTS] || 1.0 }),
        newValue: JSON.stringify({ contributionType, weight }),
        reason: `Updated contribution weight for ${contributionType} to ${weight}`,
      },
    });

    res.json({
      success: true,
      data: updatedWeight,
      error: null,
    });
  } catch (error) {
    console.error('Error updating contribution weight:', error);
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
      error: 'Failed to update contribution weight',
    });
  }
});

// Create new contribution weight (admin only)
router.post('/', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = createWeightSchema.parse(req.body);

    const weight = await prisma.contributionWeight.create({
      data: {
        contributionType: data.contributionType,
        weight: data.weight,
        description: data.description,
        updatedBy: req.user!.id,
      },
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'weight_create',
        targetUserId: req.user!.id,
        previousValue: null,
        newValue: JSON.stringify(data),
        reason: `Created contribution weight for ${data.contributionType}`,
      },
    });

    res.status(201).json({
      success: true,
      data: weight,
      error: null,
    });
  } catch (error) {
    console.error('Error creating contribution weight:', error);
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
      error: 'Failed to create contribution weight',
    });
  }
});

// Reset all weights to defaults (admin only)
router.post('/reset', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const resetWeights = [];

    for (const [type, weight] of Object.entries(DEFAULT_WEIGHTS)) {
      const updatedWeight = await prisma.contributionWeight.upsert({
        where: { contributionType: type },
        update: {
          weight,
          description: `Default weight for ${type} contributions`,
          updatedBy: req.user!.id,
        },
        create: {
          contributionType: type,
          weight,
          description: `Default weight for ${type} contributions`,
          updatedBy: req.user!.id,
        },
      });
      resetWeights.push(updatedWeight);
    }

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'weights_reset',
        targetUserId: req.user!.id,
        previousValue: null,
        newValue: JSON.stringify(DEFAULT_WEIGHTS),
        reason: 'Reset all contribution weights to defaults',
      },
    });

    res.json({
      success: true,
      data: resetWeights,
      error: null,
    });
  } catch (error) {
    console.error('Error resetting contribution weights:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to reset contribution weights',
    });
  }
});

export default router;