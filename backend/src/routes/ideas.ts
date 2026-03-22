import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { assignStarterTasks } from '../services/starterTaskService';
import { initializeCycleMetrics, auditLog } from '../services/integrityService';

const router = Router();

const submitIdeaSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(100).max(5000),
  attachments: z.array(z.string().url()).optional(),
});

// POST /api/ideas — submit idea (agreementGuard applied in server.ts)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = submitIdeaSchema.parse(req.body);
    const idea = await prisma.idea.create({
      data: {
        submittedBy: req.user!.id,
        title: data.title,
        description: data.description,
        attachments: data.attachments ? JSON.stringify(data.attachments) : null,
      },
    });
    res.status(201).json({ success: true, data: idea, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to submit idea' });
  }
});

// GET /api/ideas/my
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ideas = await prisma.idea.findMany({
      where: { submittedBy: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { cycle: { select: { id: true, name: true, state: true } } },
    });
    const parsed = ideas.map(i => ({
      ...i,
      attachments: i.attachments ? JSON.parse(i.attachments) : [],
    }));
    res.json({ success: true, data: parsed, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch ideas' });
  }
});

// GET /api/ideas/:id
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const idea = await prisma.idea.findUnique({
      where: { id: req.params.id as string },
      include: {
        submitter: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, state: true } },
      },
    });
    if (!idea) return res.status(404).json({ success: false, data: null, error: 'Not found' });

    const isAdmin = ['admin', 'founder'].includes(req.user!.role);
    if (!isAdmin && idea.submittedBy !== req.user!.id) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied' });
    }

    res.json({ success: true, data: { ...idea, attachments: idea.attachments ? JSON.parse(idea.attachments) : [] }, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch idea' });
  }
});

// GET /api/admin/ideas
router.get('/admin/list', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {};
    const ideas = await prisma.idea.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        submitter: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, state: true } },
      },
    });
    const parsed = ideas.map(i => ({ ...i, attachments: i.attachments ? JSON.parse(i.attachments) : [] }));
    res.json({ success: true, data: parsed, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch ideas' });
  }
});

// GET /api/admin/ideas/:id
router.get('/admin/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const idea = await prisma.idea.findUnique({
      where: { id: req.params.id as string },
      include: {
        submitter: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, state: true } },
      },
    });
    if (!idea) return res.status(404).json({ success: false, data: null, error: 'Not found' });
    res.json({ success: true, data: { ...idea, attachments: idea.attachments ? JSON.parse(idea.attachments) : [] }, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch idea' });
  }
});

// POST /api/admin/ideas/:id/approve
router.post('/admin/:id/approve', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { cycleName, startDate, endDate } = z.object({
      cycleName: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    }).parse(req.body);

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ success: false, data: null, error: 'startDate must be before endDate' });
    }

    const idea = await prisma.idea.findUniqueOrThrow({
      where: { id: req.params.id as string },
      include: { submitter: true },
    });

    if (idea.status !== 'PENDING') {
      return res.status(400).json({ success: false, data: null, error: 'Idea already reviewed' });
    }

    const submitter = await prisma.user.findUnique({ where: { id: idea.submittedBy } });
    if (!submitter) {
      return res.status(400).json({ success: false, data: null, error: 'Proposer account no longer exists' });
    }

    const cycle = await prisma.buildCycle.create({
      data: {
        name: cycleName ?? idea.title,
        description: idea.description,
        state: 'planned',
        startDate: start,
        endDate: end,
        participantCount: 1,
      },
    });

    await prisma.cycleParticipation.create({
      data: {
        userId: idea.submittedBy,
        cycleId: cycle.id,
        optedIn: true,
        isLead: true,
        participationStatus: 'active',
        stallStage: 'none',
      },
    });

    if (submitter.groupId) {
      await assignStarterTasks(submitter.id, submitter.groupId, cycle.id);
    }

    await prisma.idea.update({
      where: { id: idea.id },
      data: { status: 'APPROVED', reviewedBy: req.user!.id, reviewedAt: new Date(), cycleId: cycle.id },
    });

    await prisma.notification.create({
      data: {
        userId: idea.submittedBy,
        type: 'cycle_started',
        message: `Your idea "${idea.title}" was approved and a new build cycle has been created. You are the lead.`,
        metadata: JSON.stringify({ cycleId: cycle.id }),
      },
    });

    // ISSUE 8: initialize cycle metrics baseline
    await initializeCycleMetrics(cycle.id);

    // ISSUE 10: structured audit log
    await auditLog(req.user!.id, 'idea_approved', 'idea', idea.id, [idea.submittedBy], {
      cycleId: cycle.id,
      cycleName: cycle.name,
    });

    res.json({ success: true, data: { cycleId: cycle.id }, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to approve idea' });
  }
});

// POST /api/admin/ideas/:id/reject
router.post('/admin/:id/reject', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body);
    const idea = await prisma.idea.findUniqueOrThrow({ where: { id: req.params.id as string } });

    if (idea.status !== 'PENDING') {
      return res.status(400).json({ success: false, data: null, error: 'Idea already reviewed' });
    }

    await prisma.idea.update({
      where: { id: idea.id },
      data: { status: 'REJECTED', reviewedBy: req.user!.id, reviewedAt: new Date(), rejectionNote: note ?? null },
    });

    await prisma.notification.create({
      data: {
        userId: idea.submittedBy,
        type: 'admin_message',
        message: `Your idea "${idea.title}" was not approved.${note ? ' Reason: ' + note : ''}`,
        metadata: JSON.stringify({ ideaId: idea.id }),
      },
    });

    // ISSUE 10: audit log rejection
    await auditLog(req.user!.id, 'idea_rejected', 'idea', idea.id, [idea.submittedBy], {
      note: note ?? null,
    });

    res.json({ success: true, data: null, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to reject idea' });
  }
});

export default router;
