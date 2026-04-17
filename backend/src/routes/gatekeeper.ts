/**
 * Gatekeeper (Veronica) Routes
 * Role: gatekeeper, admin, founder
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { reviewUserIntake, reviewSubmission, checkVeronicaHealth } from '../services/veronicaService';

const router = Router();
const gatekeeperRoles = ['gatekeeper', 'admin', 'founder'];

// ── GET /gatekeeper/queues — summary counts for all 3 queues ─────────────────
router.get('/queues', authMiddleware, roleMiddleware(gatekeeperRoles), async (_req: AuthRequest, res: Response) => {
  try {
    const [newUsers, submissions, returned] = await Promise.all([
      prisma.gatekeeperReview.count({ where: { queue: 'new_users', status: { in: ['PENDING', 'NEEDS_REVIEW', 'FLAGGED'] } } }),
      prisma.gatekeeperReview.count({ where: { queue: 'submissions', status: { in: ['PENDING', 'NEEDS_REVIEW', 'FLAGGED', 'VALID'] } } }),
      prisma.gatekeeperReview.count({ where: { queue: 'returned' } }),
    ]);
    res.json({ success: true, data: { new_users: newUsers, submissions, returned }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch queue counts' });
  }
});

// ── GET /gatekeeper/intake — user intake queue ───────────────────────────────
router.get('/intake', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const { status, queue = 'new_users', page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { entityType: 'user_intake', queue };
    if (status) where.status = status;

    const [total, reviews] = await Promise.all([
      prisma.gatekeeperReview.count({ where }),
      prisma.gatekeeperReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
    ]);

    // Batch-fetch all triage submissions in one query — no N+1
    const triageIds = reviews.map(r => r.entityId);
    const triages = await prisma.triageSubmission.findMany({
      where: { id: { in: triageIds } },
    });
    const triageMap = new Map(triages.map(t => [t.id, t]));

    const enriched = reviews.map(r => ({
      ...r,
      veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [],
      triage: triageMap.get(r.entityId) ?? null,
    }));

    res.json({ success: true, data: { reviews: enriched, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch intake queue' });
  }
});

// ── GET /gatekeeper/submissions — submission pre-check queue ─────────────────
router.get('/submissions', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const { status, queue = 'submissions', page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Record<string, unknown> = { entityType: 'submission', queue };
    if (status) where.status = status;

    const [total, reviews] = await Promise.all([
      prisma.gatekeeperReview.count({ where }),
      prisma.gatekeeperReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
    ]);

    // Batch-fetch all activities in one query — no N+1
    const activityIds = reviews.map(r => r.entityId);
    const activities = await prisma.activityEvent.findMany({
      where: { id: { in: activityIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        linkedTask: { select: { id: true, title: true, status: true } },
      },
    });
    const activityMap = new Map(activities.map(a => [a.id, a]));

    const enriched = reviews.map(r => ({
      ...r,
      veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [],
      activity: activityMap.get(r.entityId) ?? null,
    }));

    res.json({ success: true, data: { reviews: enriched, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch submissions queue' });
  }
});

// ── POST /gatekeeper/intake/:triageId/scan — run Veronica on a triage submission
router.post('/intake/:triageId/scan', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const triageId = Array.isArray(req.params.triageId) ? req.params.triageId[0] : req.params.triageId;
    const triage = await prisma.triageSubmission.findUnique({ where: { id: triageId } });
    if (!triage) return res.status(404).json({ success: false, data: null, error: 'Triage submission not found' });

    const result = await reviewUserIntake({
      name: triage.name,
      email: triage.email,
      roleType: triage.roleType,
      description: triage.description,
      proofLinks: triage.proofLinks ?? undefined,
      availability: triage.availability ?? undefined,
    });

    // Upsert gatekeeper review
    const review = await prisma.gatekeeperReview.upsert({
      where: { id: `intake-${triageId}` },
      create: {
        id: `intake-${triageId}`,
        entityType: 'user_intake',
        entityId: triageId,
        queue: 'new_users',
        status: result.status,
        veronicaScore: result.score,
        veronicaFlags: JSON.stringify(result.flags),
        veronicaNotes: result.notes,
        aiDecision: result.aiDecision ?? null,
      },
      update: {
        status: result.status,
        veronicaScore: result.score,
        veronicaFlags: JSON.stringify(result.flags),
        veronicaNotes: result.notes,
        aiDecision: result.aiDecision ?? null,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, data: { review, veronica: result }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Veronica scan failed' });
  }
});

// ── POST /gatekeeper/submissions/:activityId/scan — run Veronica on an activity
router.post('/submissions/:activityId/scan', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.activityId) ? req.params.activityId[0] : req.params.activityId;
    const activity = await prisma.activityEvent.findUnique({ where: { id: activityId } });
    if (!activity) return res.status(404).json({ success: false, data: null, error: 'Activity not found' });

    // Count similar submissions today for duplicate check
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existingCount = await prisma.activityEvent.count({
      where: { userId: activity.userId, createdAt: { gte: today }, id: { not: activityId as string } },
    });

    const result = await reviewSubmission({
      description: activity.description ?? '',
      proofLink: activity.proofLink,
      hoursLogged: activity.hoursLogged ?? undefined,
      contributionType: activity.contributionType,
      existingCount,
    });

    const review = await prisma.gatekeeperReview.upsert({
      where: { id: `sub-${activityId}` },
      create: {
        id: `sub-${activityId}`,
        entityType: 'submission',
        entityId: activityId,
        queue: 'submissions',
        status: result.status,
        veronicaScore: result.score,
        veronicaFlags: JSON.stringify(result.flags),
        veronicaNotes: result.notes,
        aiDecision: result.aiDecision ?? null,
      },
      update: {
        status: result.status,
        veronicaScore: result.score,
        veronicaFlags: JSON.stringify(result.flags),
        veronicaNotes: result.notes,
        aiDecision: result.aiDecision ?? null,
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, data: { review, veronica: result }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Veronica scan failed' });
  }
});

// ── GET /gatekeeper/returned — combined returned queue with proper pagination ──
router.get('/returned', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { queue: 'returned' };

    const [total, reviews] = await Promise.all([
      prisma.gatekeeperReview.count({ where }),
      prisma.gatekeeperReview.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
    ]);

    // Separate by type, then batch-fetch each group — no N+1
    const intakeIds = reviews.filter(r => r.entityType === 'user_intake').map(r => r.entityId);
    const submissionIds = reviews.filter(r => r.entityType !== 'user_intake').map(r => r.entityId);

    const [triages, activities] = await Promise.all([
      intakeIds.length > 0
        ? prisma.triageSubmission.findMany({ where: { id: { in: intakeIds } } })
        : Promise.resolve([]),
      submissionIds.length > 0
        ? prisma.activityEvent.findMany({
            where: { id: { in: submissionIds } },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
    ]);

    const triageMap = new Map(triages.map(t => [t.id, t]));
    const activityMap = new Map(activities.map(a => [a.id, a]));

    const enriched = reviews.map(r => ({
      ...r,
      veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [],
      triage: r.entityType === 'user_intake' ? (triageMap.get(r.entityId) ?? null) : undefined,
      activity: r.entityType !== 'user_intake' ? (activityMap.get(r.entityId) ?? null) : undefined,
    }));

    res.json({ success: true, data: { reviews: enriched, total, page: parseInt(page), limit: parseInt(limit) }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch returned queue' });
  }
});
const actionSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED', 'SENT_BACK']),
  notes: z.string().optional(),
  queue: z.enum(['new_users', 'submissions', 'returned']).optional(),
});

router.patch('/review/:id', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { action, notes, queue } = actionSchema.parse(req.body);

    const review = await prisma.gatekeeperReview.update({
      where: { id },
      data: {
        status: action,
        notes: notes ?? undefined,
        queue: action === 'SENT_BACK' ? 'returned' : (queue ?? undefined),
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, data: review, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, data: null, error: err.errors });
    res.status(500).json({ success: false, data: null, error: 'Failed to update review' });
  }
});

// ── PATCH /gatekeeper/review/:id/move — move item between queues ─────────────
router.patch('/review/:id/move', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { queue } = z.object({ queue: z.enum(['new_users', 'submissions', 'returned']) }).parse(req.body);

    const review = await prisma.gatekeeperReview.update({
      where: { id },
      data: { queue, updatedAt: new Date() },
    });

    res.json({ success: true, data: review, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to move item' });
  }
});

// ── GET /gatekeeper/veronica/status — Ollama health check ────────────────────
router.get('/veronica/status', authMiddleware, roleMiddleware(gatekeeperRoles), async (_req: AuthRequest, res: Response) => {
  try {
    const health = await checkVeronicaHealth();
    res.json({ success: true, data: health, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Health check failed' });
  }
});

// ── GET /gatekeeper/reports — list daily reports ─────────────────────────────
router.get('/reports', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '30' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [total, reports] = await Promise.all([
      prisma.dailyReport.count(),
      prisma.dailyReport.findMany({
        orderBy: { reportDate: 'desc' },
        skip,
        take: parseInt(limit),
      }),
    ]);

    res.json({ success: true, data: { reports, total }, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch reports' });
  }
});

// ── POST /gatekeeper/reports/generate — manually trigger today's report ──────
router.post('/reports/generate', authMiddleware, roleMiddleware(gatekeeperRoles), async (_req: AuthRequest, res: Response) => {
  try {
    const report = await generateDailyReport();
    res.json({ success: true, data: report, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to generate report' });
  }
});

// ── GET /gatekeeper/reports/:date/detail — full record breakdown for a day ───
// date param: YYYY-MM-DD (UTC)
router.get('/reports/:date/detail', authMiddleware, roleMiddleware(gatekeeperRoles), async (req: AuthRequest, res: Response) => {
  try {
    const dateStr = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    const dayStart = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const dayEnd   = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));

    const [
      approvedTriages,
      rejectedTriages,
      verifiedActivities,
      rejectedActivities,
      changesRequestedActivities,
      newTriages,
    ] = await Promise.all([
      // Triage submissions approved today
      prisma.triageSubmission.findMany({
        where: { status: 'APPROVED', reviewedAt: { gte: dayStart, lt: dayEnd } },
        select: { id: true, name: true, email: true, roleType: true, reviewedAt: true },
        orderBy: { reviewedAt: 'desc' },
      }),
      // Triage submissions rejected today
      prisma.triageSubmission.findMany({
        where: { status: 'REJECTED', reviewedAt: { gte: dayStart, lt: dayEnd } },
        select: { id: true, name: true, email: true, roleType: true, reviewedAt: true, rejectionNote: true },
        orderBy: { reviewedAt: 'desc' },
      }),
      // Activities verified today
      prisma.activityEvent.findMany({
        where: { status: 'verified', verifiedAt: { gte: dayStart, lt: dayEnd } },
        select: {
          id: true,
          contributionType: true,
          hoursLogged: true,
          calculatedOwnership: true,
          verifiedAt: true,
          proofLink: true,
          user: { select: { id: true, name: true, email: true } },
          verifier: { select: { id: true, name: true, email: true } },
          linkedTask: { select: { id: true, title: true } },
        },
        orderBy: { verifiedAt: 'desc' },
      }),
      // Activities rejected today
      prisma.activityEvent.findMany({
        where: { status: 'rejected', verifiedAt: { gte: dayStart, lt: dayEnd } },
        select: {
          id: true,
          contributionType: true,
          hoursLogged: true,
          verifiedAt: true,
          rejectionReason: true,
          proofLink: true,
          user: { select: { id: true, name: true, email: true } },
          verifier: { select: { id: true, name: true, email: true } },
        },
        orderBy: { verifiedAt: 'desc' },
      }),
      // Activities with changes requested today
      prisma.activityEvent.findMany({
        where: { status: 'changes_requested', verifiedAt: { gte: dayStart, lt: dayEnd } },
        select: {
          id: true,
          contributionType: true,
          hoursLogged: true,
          verifiedAt: true,
          rejectionReason: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { verifiedAt: 'desc' },
      }),
      // New triage submissions created today
      prisma.triageSubmission.findMany({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
        select: { id: true, name: true, email: true, roleType: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        date: dateStr,
        approvedTriages,
        rejectedTriages,
        verifiedActivities,
        rejectedActivities,
        changesRequestedActivities,
        newTriages,
      },
      error: null,
    });
  } catch (err) {
    console.error('Report detail error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch report detail' });
  }
});

export async function generateDailyReport() {
  // Use UTC midnight to prevent timezone-related duplicate-key errors
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [
    newSignups, approvedUsers, rejectedUsers,
    totalSubmissions, approvedSubmissions, rejectedSubmissions, pendingSubmissions,
    openCycles, pendingReviews, flaggedItems,
  ] = await Promise.all([
    prisma.triageSubmission.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.triageSubmission.count({ where: { status: 'APPROVED', reviewedAt: { gte: today, lt: tomorrow } } }),
    prisma.triageSubmission.count({ where: { status: 'REJECTED', reviewedAt: { gte: today, lt: tomorrow } } }),
    prisma.activityEvent.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.activityEvent.count({ where: { status: 'verified', verifiedAt: { gte: today, lt: tomorrow } } }),
    prisma.activityEvent.count({ where: { status: 'rejected', verifiedAt: { gte: today, lt: tomorrow } } }),
    prisma.activityEvent.count({ where: { status: 'pending', createdAt: { gte: today, lt: tomorrow } } }),
    prisma.buildCycle.count({ where: { state: { in: ['active', 'planned'] } } }),
    prisma.gatekeeperReview.count({ where: { status: { in: ['PENDING', 'NEEDS_REVIEW'] } } }),
    prisma.gatekeeperReview.count({ where: { status: 'FLAGGED' } }),
  ]);

  // Active contributors: users with at least 1 activity in last 7 days
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeContributorIds = await prisma.activityEvent.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { userId: true },
    distinct: ['userId'],
  });
  const activeContributors = activeContributorIds.length;

  const totalUsers = await prisma.userProfile.count();
  const inactiveContributors = Math.max(0, totalUsers - activeContributors);

  // Compute AI detection stats for metadata
  const [aiAutoBlocked, aiAutoPass, aiFallback] = await Promise.all([
    prisma.gatekeeperReview.count({ where: { veronicaScore: { lte: 0.30 }, updatedAt: { gte: today, lt: tomorrow } } }),
    prisma.gatekeeperReview.count({ where: { veronicaScore: { gte: 0.75 }, updatedAt: { gte: today, lt: tomorrow } } }),
    prisma.gatekeeperReview.count({ where: { veronicaFlags: { contains: 'ai_fallback' }, updatedAt: { gte: today, lt: tomorrow } } }),
  ]);

  const metadata = JSON.stringify({
    aiAutoBlocked,
    aiAutoPass,
    aiFallback,
    generatedBy: 'system',
    version: '2',
  });

  return prisma.dailyReport.upsert({
    where: { reportDate: today },
    create: {
      reportDate: today,
      newSignups, approvedUsers, rejectedUsers,
      totalSubmissions, approvedSubmissions, rejectedSubmissions, pendingSubmissions,
      activeContributors, inactiveContributors,
      openCycles, pendingReviews, flaggedItems,
      metadata,
    },
    update: {
      newSignups, approvedUsers, rejectedUsers,
      totalSubmissions, approvedSubmissions, rejectedSubmissions, pendingSubmissions,
      activeContributors, inactiveContributors,
      openCycles, pendingReviews, flaggedItems,
      metadata,
      generatedAt: new Date(),
    },
  });
}

export default router;

// ── POST /gatekeeper/backtest — re-evaluate existing VALID activities with new logic ──
// Admin/founder only — runs Veronica's new semantic checks against all previously VALID submissions
router.post('/backtest', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: AuthRequest, res: Response) => {
  try {
    const reviews = await prisma.gatekeeperReview.findMany({
      where: { entityType: 'submission', status: { in: ['VALID', 'APPROVED'] } },
      select: { id: true, entityId: true, veronicaScore: true, aiDecision: true },
    });

    if (reviews.length === 0) {
      return res.json({ success: true, data: { total: 0, suspicious: [], suspiciousRate: '0%' }, error: null });
    }

    const activityIds = reviews.map(r => r.entityId);
    const activities = await prisma.activityEvent.findMany({
      where: { id: { in: activityIds } },
      select: { id: true, description: true, proofLink: true, hoursLogged: true, contributionType: true },
    });
    const activityMap = new Map(activities.map(a => [a.id, a]));

    const { ruleBasedSubmissionCheckExport } = await import('../services/veronicaService');

    const suspicious: Array<{
      reviewId: string; activityId: string; originalScore: number | null;
      newScore: number; newStatus: string; flags: string[]; reasoning: string;
    }> = [];

    for (const review of reviews) {
      const activity = activityMap.get(review.entityId);
      if (!activity) continue;
      const result = ruleBasedSubmissionCheckExport({
        description: activity.description ?? '',
        proofLink: activity.proofLink,
        hoursLogged: activity.hoursLogged ?? undefined,
      });
      if (result.status !== 'VALID' || result.score < 0.7) {
        suspicious.push({
          reviewId: review.id,
          activityId: activity.id,
          originalScore: review.veronicaScore,
          newScore: result.score,
          newStatus: result.status,
          flags: result.flags,
          reasoning: result.notes,
        });
      }
    }

    const suspiciousRate = `${((suspicious.length / reviews.length) * 100).toFixed(1)}%`;

    await prisma.systemLog.create({
      data: {
        event: 'veronica_backtest_run',
        severity: suspicious.length > 0 ? 'WARNING' : 'INFO',
        message: `[Veronica] Backtest — ${suspicious.length}/${reviews.length} previously VALID submissions flagged (${suspiciousRate})`,
        metadata: JSON.stringify({ total: reviews.length, suspiciousCount: suspicious.length, suspiciousRate }),
      },
    });

    res.json({ success: true, data: { total: reviews.length, suspiciousCount: suspicious.length, suspiciousRate, suspicious }, error: null });
  } catch (err) {
    console.error('Backtest error:', err);
    res.status(500).json({ success: false, data: null, error: 'Backtest failed' });
  }
});
