/**
 * Scoring Engine — Phase 2a Routes
 *
 * Endpoints for managing scoring weights and retrieving application scores.
 * All admin/founder routes require auth + gatekeeper/admin/founder role.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import {
  recomputeApplicationScore,
  loadScoringWeights,
} from '../services/scoring/applicationScoringService';
import {
  executeRouting,
  resolveRouteAssignment,
} from '../services/scoring/routingService';
import logger from '../utils/logger';

const router = Router();

const scoringReadRoles = ['admin', 'founder', 'gatekeeper'];
const scoringWriteRoles = ['admin', 'founder'];

// ── Scoring Weights ───────────────────────────────────────────────────────────

/**
 * GET /api/scoring/weights — Get all active scoring weights
 * Accessible to authenticated users (read-only).
 */
router.get('/weights', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const weights = await prisma.scoringWeight.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const activeWeights = await loadScoringWeights();

    res.json({
      success: true,
      data: {
        weights,
        activeWeights,
      },
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to fetch weights', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch scoring weights' });
  }
});

/**
 * PUT /api/scoring/weights — Update scoring weights (admin/founder only)
 * Body: { weights: [{ weightKey: string, weight: number }] }
 */
const updateWeightsSchema = z.object({
  weights: z.array(
    z.object({
      weightKey: z.enum(['intent', 'capital', 'execution', 'vp', 'availability', 'veronica']),
      weight: z.number().min(0).max(10),
      label: z.string().max(100).optional(),
      description: z.string().max(500).optional(),
    })
  ).min(1).max(10),
});

router.put('/weights', authMiddleware, roleMiddleware(scoringWriteRoles), async (req: AuthRequest, res: Response) => {
  try {
    const data = updateWeightsSchema.parse(req.body);

    const userId = req.user!.id;
    const results = [];
    for (const w of data.weights) {
      const result = await prisma.scoringWeight.upsert({
        where: { weightKey: w.weightKey },
        update: {
          weight: w.weight,
          label: w.label ?? undefined,
          description: w.description ?? undefined,
          updatedBy: userId,
        },
        create: {
          weightKey: w.weightKey,
          weight: w.weight,
          label: w.label ?? null,
          description: w.description ?? null,
          isActive: true,
          updatedBy: userId,
        },
      });
      results.push(result);
    }

    // Log weight update
    await prisma.systemLog.create({
      data: {
        event: 'scoring_weights_updated',
        severity: 'INFO',
        message: `[Scoring] Scoring weights updated by ${userId}`,
        metadata: JSON.stringify({ weights: data.weights, updatedBy: userId }),
      },
    }).catch(() => {});

    res.json({
      success: true,
      data: { updated: results.length, weights: results },
      error: null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0]?.message || 'Validation failed' });
    }
    logger.error('[Scoring] Failed to update weights', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to update scoring weights' });
  }
});

// ── Application Scores ────────────────────────────────────────────────────────

/**
 * GET /api/scoring/applications — List application scores (paginated, filterable)
 * Query params: page, limit, routeTag, sortBy, sortOrder
 */
router.get('/applications', authMiddleware, roleMiddleware(scoringReadRoles), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const routeTagInput = req.query.routeTag;
    const routeTag = typeof routeTagInput === 'string' ? routeTagInput : undefined;
    const sortBy = (req.query.sortBy as string) || 'scoredAt';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (routeTag && ['fast_track', 'standard', 'hold'].includes(routeTag)) {
      where.routeTag = routeTag;
    }

    const validSortFields = ['totalScore', 'scoredAt', 'routeTag'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'scoredAt';

    const [total, scores] = await Promise.all([
      prisma.applicationScore.count({ where }),
      prisma.applicationScore.findMany({
        where,
        orderBy: { [orderByField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: {
        scores,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to fetch application scores', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch application scores' });
  }
});

/**
 * GET /api/scoring/applications/:id — Get single application score breakdown
 */
router.get('/applications/:id', authMiddleware, roleMiddleware(scoringReadRoles), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const score = await prisma.applicationScore.findUnique({
      where: { entryIntakeId: id },
    });

    if (!score) {
      return res.status(404).json({ success: false, data: null, error: 'Application score not found' });
    }

    // Also fetch the intake for context
    const intake = await prisma.entryIntake.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        email: true,
        intentType: true,
        capitalRange: true,
        status: true,
      },
    });

    res.json({
      success: true,
      data: {
        score,
        intake,
      },
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to fetch application score', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch application score' });
  }
});

/**
 * POST /api/scoring/applications/:id/recompute — Force recompute application score
 */
router.post('/applications/:id/recompute', authMiddleware, roleMiddleware(scoringWriteRoles), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const intake = await prisma.entryIntake.findUnique({ where: { id } });
    if (!intake) {
      return res.status(404).json({ success: false, data: null, error: 'Intake not found' });
    }

    const result = await recomputeApplicationScore(id);

    if (!result) {
      return res.status(500).json({ success: false, data: null, error: 'Failed to recompute score' });
    }

    res.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to recompute score', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to recompute score' });
  }
});

// ── Tier Thresholds ────────────────────────────────────────────────────────

/**
 * GET /api/scoring/tiers — Get all tier thresholds
 * Accessible to authenticated users (read-only).
 */
router.get('/tiers', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const thresholds = await prisma.tierThreshold.findMany({
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: { thresholds },
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to fetch tier thresholds', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch tier thresholds' });
  }
});

/**
 * PUT /api/scoring/tiers — Update tier thresholds (admin/founder only)
 * Body: { thresholds: [{ tier: string, minScore: number, minCycles: number, description?: string, isActive?: boolean }] }
 */
const updateTiersSchema = z.object({
  thresholds: z.array(
    z.object({
      tier: z.enum(['founder', 'core', 'contributor', 'employee', 'observer']),
      minScore: z.number().min(0).max(100),
      minCycles: z.number().int().min(0).max(100),
      description: z.string().max(500).optional(),
      isActive: z.boolean().optional(),
    })
  ).min(1).max(10),
});

// ── Route Assignments ───────────────────────────────────────────────────────

/**
 * GET /api/scoring/routes — List route assignments (paginated, filterable)
 * Query params: page, limit, route, priority
 */
router.get('/routes', authMiddleware, roleMiddleware(scoringReadRoles), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const routeFilter = req.query.route as string | undefined;
    const priorityFilter = req.query.priority as string | undefined;

    const where: Record<string, unknown> = {};
    if (routeFilter && ['onboarding', 'gatekeeper', 'founder_review', 'vc_intro'].includes(routeFilter)) {
      where.route = routeFilter;
    }
    if (priorityFilter && ['high', 'normal', 'low'].includes(priorityFilter)) {
      where.priority = priorityFilter;
    }

    const [total, routes] = await Promise.all([
      prisma.routeAssignment.count({ where }),
      prisma.routeAssignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: {
        routes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to fetch route assignments', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch route assignments' });
  }
});

/**
 * POST /api/scoring/routes/:id/resolve — Mark route assignment as resolved
 */
router.post('/routes/:id/resolve', authMiddleware, roleMiddleware(scoringWriteRoles), async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const assignment = await prisma.routeAssignment.findUnique({ where: { id } });
    if (!assignment) {
      return res.status(404).json({ success: false, data: null, error: 'Route assignment not found' });
    }

    if (assignment.resolvedAt) {
      return res.status(409).json({ success: false, data: null, error: 'Route assignment already resolved' });
    }

    const resolved = await resolveRouteAssignment(id, req.user!.id);

    if (!resolved) {
      return res.status(500).json({ success: false, data: null, error: 'Failed to resolve route assignment' });
    }

    res.json({
      success: true,
      data: { message: 'Route assignment resolved', id },
      error: null,
    });
  } catch (err) {
    logger.error('[Scoring] Failed to resolve route assignment', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to resolve route assignment' });
  }
});

/**
 * POST /api/scoring/routes — Manually trigger routing for a scored intake
 * Body: { entryIntakeId: string }
 */
const triggerRouteSchema = z.object({
  entryIntakeId: z.string().min(1, 'Entry intake ID is required'),
});

router.post('/routes', authMiddleware, roleMiddleware(scoringWriteRoles), async (req: AuthRequest, res: Response) => {
  try {
    const data = triggerRouteSchema.parse(req.body);

    // Fetch intake
    const intake = await prisma.entryIntake.findUnique({ where: { id: data.entryIntakeId } });
    if (!intake) {
      return res.status(404).json({ success: false, data: null, error: 'Entry intake not found' });
    }

    // Fetch score
    const score = await prisma.applicationScore.findUnique({ where: { entryIntakeId: data.entryIntakeId } });
    if (!score) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'No score found for this intake. Run scoring first.',
      });
    }

    const subScores = score.subScores ? JSON.parse(score.subScores) : {};

    const result = await executeRouting(
      intake.id,
      intake.fullName,
      intake.email,
      intake.intentType,
      intake.capitalRange,
      {
        entryIntakeId: intake.id,
        totalScore: score.totalScore,
        routeTag: score.routeTag as 'fast_track' | 'standard' | 'hold',
        subScores,
        scoredAt: score.scoredAt,
      },
    );

    if (!result) {
      return res.status(500).json({ success: false, data: null, error: 'Routing failed' });
    }

    res.json({
      success: true,
      data: result,
      error: null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0]?.message || 'Validation failed' });
    }
    logger.error('[Scoring] Failed to trigger routing', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to trigger routing' });
  }
});

router.put('/tiers', authMiddleware, roleMiddleware(scoringWriteRoles), async (req: AuthRequest, res: Response) => {
  try {
    const data = updateTiersSchema.parse(req.body);

    const results = [];
    for (const t of data.thresholds) {
      const result = await prisma.tierThreshold.upsert({
        where: { tier: t.tier },
        update: {
          minScore: t.minScore,
          minCycles: t.minCycles,
          description: t.description ?? undefined,
          isActive: t.isActive ?? undefined,
        },
        create: {
          tier: t.tier,
          minScore: t.minScore,
          minCycles: t.minCycles,
          description: t.description ?? null,
          isActive: t.isActive ?? true,
        },
      });
      results.push(result);
    }

    // Log tier update
    await prisma.systemLog.create({
      data: {
        event: 'tier_thresholds_updated',
        severity: 'INFO',
        message: `[Scoring] Tier thresholds updated by ${req.user!.id}`,
        metadata: JSON.stringify({ thresholds: data.thresholds, updatedBy: req.user!.id }),
      },
    }).catch(() => {});

    res.json({
      success: true,
      data: { updated: results.length, thresholds: results },
      error: null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0]?.message || 'Validation failed' });
    }
    logger.error('[Scoring] Failed to update tier thresholds', { err });
    res.status(500).json({ success: false, data: null, error: 'Failed to update tier thresholds' });
  }
});

export default router;
