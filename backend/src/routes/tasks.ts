import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, requireFullAccess, AuthRequest } from '../middleware/auth';

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  cycleId: z.string(),
  dueDate: z.string().optional(),
});

const assignTaskSchema = z.object({
  taskId: z.string(),
  userIds: z.array(z.string()).min(1),
});

// Helper: check if user is on leave for a cycle
async function isUserOnLeave(userId: string, cycleId: string): Promise<boolean> {
  const now = new Date();
  const leave = await prisma.participationLeave.findFirst({
    where: {
      userId,
      cycleId,
      status: 'paused',
      leaveStart: { lte: now },
      OR: [{ leaveEnd: null }, { leaveEnd: { gte: now } }],
    },
  });
  return !!leave;
}

// GET /tasks?cycleId=
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cycleId } = req.query;
    const where: Record<string, unknown> = {};
    if (cycleId) where.cycleId = cycleId as string;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    // Auto-mark overdue
    const now = new Date();
    const updated = tasks.map(t => ({
      ...t,
      status:
        t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now
          ? 'overdue'
          : t.status,
    }));

    res.json({ success: true, data: updated, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch tasks' });
  }
});

// GET /tasks/my — current user's assigned tasks
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await prisma.taskAssignment.findMany({
      where: { userId: req.user!.id },
      include: {
        task: {
          include: {
            creator: { select: { id: true, name: true, email: true } },
            cycle: { select: { id: true, name: true, state: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const result = assignments.map(a => ({
      ...a,
      task: {
        ...a.task,
        status:
          a.task.status !== 'completed' && a.task.dueDate && new Date(a.task.dueDate) < now
            ? 'overdue'
            : a.task.status,
      },
    }));

    res.json({ success: true, data: result, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch tasks' });
  }
});

// POST /tasks — admin only
router.post('/', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        cycleId: data.cycleId,
        createdBy: req.user!.id,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        status: 'open',
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: true,
      },
    });

    res.status(201).json({ success: true, data: task, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to create task' });
  }
});

// POST /tasks/assign — admin only
router.post('/assign', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, userIds } = assignTaskSchema.parse(req.body);

    const assignments = await Promise.all(
      userIds.map(userId =>
        prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId, userId } },
          create: { taskId, userId, status: 'assigned' },
          update: {},
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      )
    );

    // Notify assigned users
    await Promise.all(
      userIds.map(userId =>
        prisma.notification.create({
          data: {
            userId,
            type: 'task_assigned',
            message: 'You have been assigned a new task.',
            metadata: JSON.stringify({ taskId }),
          },
        })
      )
    );

    res.json({ success: true, data: assignments, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to assign task' });
  }
});

// PATCH /tasks/:id/complete — mark assignment complete
router.patch('/:id/complete', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const userId = req.user!.id;

    // Check leave status
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ success: false, data: null, error: 'Task not found' });

    const onLeave = await isUserOnLeave(userId, task.cycleId);
    if (onLeave) {
      return res.status(403).json({ success: false, data: null, error: 'Cannot complete tasks while on leave' });
    }

    const assignment = await prisma.taskAssignment.update({
      where: { taskId_userId: { taskId, userId } },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Check if all assignments are complete → mark task complete
    const allAssignments = await prisma.taskAssignment.findMany({ where: { taskId } });
    const allDone = allAssignments.every(a => a.status === 'completed');
    if (allDone) {
      await prisma.task.update({ where: { id: taskId }, data: { status: 'completed' } });
    }

    res.json({ success: true, data: assignment, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to complete task' });
  }
});

// PATCH /tasks/:id/progress — update assignment status (in_progress)
router.patch('/:id/progress', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ success: false, data: null, error: 'Task not found' });

    const onLeave = await isUserOnLeave(userId, task.cycleId);
    if (onLeave) {
      return res.status(403).json({ success: false, data: null, error: 'Cannot update tasks while on leave' });
    }

    const assignment = await prisma.taskAssignment.update({
      where: { taskId_userId: { taskId, userId } },
      data: { status: 'in_progress' },
    });

    res.json({ success: true, data: assignment, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Failed to update task' });
  }
});

export default router;
