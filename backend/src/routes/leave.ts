import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, requireFullAccess, AuthRequest } from '../middleware/auth';

const router = Router();

const requestLeaveSchema = z.object({
  cycleId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

const adminGrantLeaveSchema = z.object({
  userId: z.string(),
  cycleId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

const overrideStatusSchema = z.object({
  userId: z.string(),
  cycleId: z.string(),
  status: z.enum(['active', 'paused', 'left']),
  reason: z.string().optional(),
});

// POST /leave/request — user requests leave
router.post('/request', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
  try {
    const data = requestLeaveSchema.parse(req.body);
    const userId = req.user!.id;

    const leave = await prisma.participationLeave.create({
      data: {
        userId,
        cycleId: data.cycleId,
        status: 'paused',
        leaveStart: new Date(data.startDate),
        leaveEnd: new Date(data.endDate),
        reason: data.reason,
      },
    });

    // Update CycleParticipation status to paused
    await prisma.cycleParticipation.updateMany({
      where: { userId, cycleId: data.cycleId },
      data: { participationStatus: 'paused', stallStage: 'paused' },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'participation_paused',
        message: `Your participation has been paused from ${data.startDate} to ${data.endDate}.`,
        metadata: JSON.stringify({ leaveId: leave.id }),
      },
    });

    res.status(201).json({ success: true, data: leave, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to request leave' });
  }
});

// GET /leave/my — current user's leave records
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const leaves = await prisma.participationLeave.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { cycle: { select: { id: true, name: true } } },
    });
    res.json({ success: true, data: leaves, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch leave records' });
  }
});

// GET /leave/status/:cycleId — check if current user is on leave for a cycle
router.get('/status/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const leave = await prisma.participationLeave.findFirst({
      where: {
        userId: req.user!.id,
        cycleId: req.params.cycleId as string,
        status: 'paused',
        leaveStart: { lte: now },
        OR: [{ leaveEnd: null }, { leaveEnd: { gte: now } }],
      },
    });
    res.json({ success: true, data: { onLeave: !!leave, leave: leave ?? null }, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to check leave status' });
  }
});

// POST /leave/admin/grant — admin grants leave to a user
router.post('/admin/grant', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = adminGrantLeaveSchema.parse(req.body);

    const leave = await prisma.participationLeave.create({
      data: {
        userId: data.userId,
        cycleId: data.cycleId,
        status: 'paused',
        leaveStart: new Date(data.startDate),
        leaveEnd: new Date(data.endDate),
        reason: data.reason,
        grantedBy: req.user!.id,
      },
    });

    await prisma.cycleParticipation.updateMany({
      where: { userId: data.userId, cycleId: data.cycleId },
      data: { participationStatus: 'paused', stallStage: 'paused' },
    });

    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: 'participation_paused',
        message: `An admin has granted you leave from ${data.startDate} to ${data.endDate}.`,
        metadata: JSON.stringify({ leaveId: leave.id, grantedBy: req.user!.id }),
      },
    });

    res.status(201).json({ success: true, data: leave, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to grant leave' });
  }
});

// PATCH /leave/admin/override — admin overrides participation status
router.patch('/admin/override', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = overrideStatusSchema.parse(req.body);

    await prisma.cycleParticipation.updateMany({
      where: { userId: data.userId, cycleId: data.cycleId },
      data: {
        participationStatus: data.status === 'active' ? 'active' : data.status,
        stallStage: data.status === 'active' ? 'none' : data.status,
      },
    });

    if (data.status === 'active') {
      // End any active leave
      await prisma.participationLeave.updateMany({
        where: { userId: data.userId, cycleId: data.cycleId, status: 'paused' },
        data: { status: 'active', leaveEnd: new Date() },
      });
    }

    res.json({ success: true, data: { userId: data.userId, cycleId: data.cycleId, status: data.status }, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to override status' });
  }
});

// GET /leave/admin/all — admin view all leave records
router.get('/admin/all', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const leaves = await prisma.participationLeave.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data: leaves, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch leave records' });
  }
});

export default router;
