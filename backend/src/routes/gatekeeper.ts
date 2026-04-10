/**
 * Gatekeeper (Veronica) Routes
 * Role: gatekeeper, admin, founder
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { reviewUserIntake, reviewSubmission } from '../services/veronicaService';

const router = Router();
const gatekeeperRoles = ['gatekeeper', 'admin', 'founder'];

// ── GET /gatekeeper/queues — summary counts for all 3 queues ─────────────────
router.get('/queues', authMiddleware, roleMiddleware(gatekeeperRoles), async (_req: AuthRequest, res: Response) => {
  try {
    const [newUsers, submissions, returned] = await Promise.all([
      prisma.gatekeeperReview.count({ where: { queue: 'new_users', status: { in: ['PENDING', 'NEEDS_REVIEW', 'FLAGGED'] } } }),
      prisma.gatekeeperReview.count({ where: { queue: 'submissions', status: { in: ['PENDING', 'NEEDS_REVIEW', 'FLAGGED'] } } }),
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

    // Enrich with triage submission data
    const enriched = await Promise.all(reviews.map(async (r) => {
      const triage = await prisma.triageSubmission.findUnique({ where: { id: r.entityId } });
      return { ...r, veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [], triage };
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

    const enriched = await Promise.all(reviews.map(async (r) => {
      const activity = await prisma.activityEvent.findUnique({
        where: { id: r.entityId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          linkedTask: { select: { id: true, title: true, status: true } },
        },
      });
      return { ...r, veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [], activity };
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
      },
      update: {
        status: result.status,
        veronicaScore: result.score,
        veronicaFlags: JSON.stringify(result.flags),
        veronicaNotes: result.notes,
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
      },
      update: {
        status: result.status,
        veronicaScore: result.score,
        veronicaFlags: JSON.stringify(result.flags),
        veronicaNotes: result.notes,
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

    const enriched = await Promise.all(reviews.map(async (r) => {
      if (r.entityType === 'user_intake') {
        const triage = await prisma.triageSubmission.findUnique({ where: { id: r.entityId } });
        return { ...r, veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [], triage };
      } else {
        const activity = await prisma.activityEvent.findUnique({
          where: { id: r.entityId },
          include: { user: { select: { id: true, name: true, email: true } } },
        });
        return { ...r, veronicaFlags: r.veronicaFlags ? JSON.parse(r.veronicaFlags) : [], activity };
      }
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

export async function generateDailyReport() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

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

  return prisma.dailyReport.upsert({
    where: { reportDate: today },
    create: {
      reportDate: today,
      newSignups, approvedUsers, rejectedUsers,
      totalSubmissions, approvedSubmissions, rejectedSubmissions, pendingSubmissions,
      activeContributors, inactiveContributors,
      openCycles, pendingReviews, flaggedItems,
    },
    update: {
      newSignups, approvedUsers, rejectedUsers,
      totalSubmissions, approvedSubmissions, rejectedSubmissions, pendingSubmissions,
      activeContributors, inactiveContributors,
      openCycles, pendingReviews, flaggedItems,
      generatedAt: new Date(),
    },
  });
}

export default router;
