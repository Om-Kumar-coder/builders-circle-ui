import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, requireFullAccess, AuthRequest } from '../middleware/auth';
import { claimTask, isActiveParticipant, auditLog } from '../services/integrityService';

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
  proofLink: z.string().optional(),
  securityNote: z.string().optional(),
  restricted: z.boolean().optional(),
  isStarter: z.boolean().optional(),
  // ISSUE 3: cap concurrent claimants; defaults to 1
  maxAssignments: z.number().int().min(1).max(100).optional(),
  // ISSUE 7: reduced weight for starter tasks (default 0.2)
  starterWeight: z.number().min(0).max(1).optional(),
  groupId: z.string().optional(),
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

// GET /tasks/my — current user's assigned tasks (direct + group-scoped)
// NOTE: this MUST be registered before GET /:id so Express doesn't treat "my" as an id
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { groupId: true },
    });

    const { cycleId } = req.query;

    const assignments = await prisma.taskAssignment.findMany({
      where: { userId: req.user!.id },
      include: {
        task: {
          include: {
            creator: { select: { id: true, name: true, email: true } },
            cycle: { select: { id: true, name: true, state: true } },
            group: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch group-scoped tasks not yet directly assigned
    let groupTasks: typeof assignments = [];
    if (user?.groupId) {
      const groupWhere: Record<string, unknown> = { groupId: user.groupId };
      if (cycleId) groupWhere.cycleId = cycleId as string;

      const assignedTaskIds = new Set(assignments.map(a => a.taskId));
      const gTasks = await prisma.task.findMany({
        where: groupWhere,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          cycle: { select: { id: true, name: true, state: true } },
          group: { select: { id: true, name: true } },
        },
      });

      groupTasks = gTasks
        .filter(t => !assignedTaskIds.has(t.id))
        .map(t => ({
          id: `group-${t.id}`,
          taskId: t.id,
          userId: req.user!.id,
          status: 'assigned' as const,
          claimedAt: null,
          submittedAt: null,
          completedAt: null,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          task: t,
        }));
    }

    const now = new Date();
    const result = [...assignments, ...groupTasks].map(a => ({
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

// GET /tasks/:id — single task detail
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id as string },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!task) return res.status(404).json({ success: false, data: null, error: 'Task not found' });

    // Non-admin users cannot see securityNote/restricted details if restricted
    const isAdmin = ['admin', 'founder'].includes(req.user!.role);
    const safeTask = {
      ...task,
      securityNote: isAdmin ? task.securityNote : (task.restricted ? '🔒 Details restricted' : null),
    };

    res.json({ success: true, data: safeTask, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch task' });
  }
});

// GET /tasks?cycleId=
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { cycleId, isStarter } = req.query;
    const where: Record<string, unknown> = {};
    if (cycleId) where.cycleId = cycleId as string;
    if (isStarter === 'true') where.isStarter = true;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        group: { select: { id: true, name: true } },
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

// POST /tasks — admin only
router.post('/', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description,
        acceptanceCriteria: data.acceptanceCriteria,
        proofLink: data.proofLink,
        securityNote: data.securityNote,
        restricted: data.restricted ?? false,
        isStarter: data.isStarter ?? false,
        // ISSUE 7: starter tasks default to 0.2 weight; non-starters default to 1.0
        starterWeight: data.starterWeight ?? (data.isStarter ? 0.2 : 1.0),
        // ISSUE 3: cap concurrent claimants
        maxAssignments: data.maxAssignments ?? 1,
        groupId: data.groupId,
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

    // ISSUE 10: audit log task creation
    await auditLog(req.user!.id, 'task_created', 'task', task.id, [], {
      title: task.title,
      cycleId: task.cycleId,
      isStarter: task.isStarter,
      maxAssignments: task.maxAssignments,
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

// PATCH /tasks/:id — update task fields (admin only)
router.patch('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const updateSchema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      acceptanceCriteria: z.string().optional(),
      isStarter: z.boolean().optional(),
      groupId: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    });
    const data = updateSchema.parse(req.body);
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate === null ? null : undefined,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        group: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, data: task, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to update task' });
  }
});

// PATCH /tasks/:id/status — admin: set arbitrary status (for Kanban drag-and-drop)
router.patch('/:id/status', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const { status } = req.body as { status: string };
    const allowed = ['open', 'in_progress', 'review', 'completed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid status' });
    }
    const task = await prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    res.json({ success: true, data: task, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to update task status' });
  }
});

// PATCH /tasks/:id/claim — ISSUE 4: user claims a task (locks it, enforces maxAssignments)
router.patch('/:id/claim', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ success: false, data: null, error: 'Task not found' });

    // ISSUE 5: must be an active participant in the cycle
    const active = await isActiveParticipant(userId, task.cycleId);
    if (!active) {
      return res.status(403).json({ success: false, data: null, error: 'Must be an active cycle participant to claim tasks' });
    }

    const onLeave = await isUserOnLeave(userId, task.cycleId);
    if (onLeave) {
      return res.status(403).json({ success: false, data: null, error: 'Cannot claim tasks while on leave' });
    }

    const assignment = await claimTask(userId, taskId);

    // ISSUE 10: audit log
    await auditLog(userId, 'task_claimed', 'task', taskId, [userId], { cycleId: task.cycleId });

    res.json({ success: true, data: assignment, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to claim task';
    const status = msg.includes('not found') ? 404 : msg.includes('fully claimed') || msg.includes('already claimed') ? 409 : 500;
    res.status(status).json({ success: false, data: null, error: msg });
  }
});

// PATCH /tasks/:id/complete — ISSUE 2: BLOCKED — tasks complete only via approved activity
// Kept for backward compat but now returns a clear error directing users to submit activity
router.patch('/:id/complete', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
  return res.status(400).json({
    success: false,
    data: null,
    error: 'Tasks cannot be marked complete directly. Submit an activity linked to this task — it will be marked approved once the activity is verified.',
  });
});

// PATCH /tasks/:id/progress — redirects to /claim (backward compat)
// ISSUE 4: use /claim instead; this is kept so existing clients don't break
router.patch('/:id/progress', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
  try {
    const taskId = req.params.id as string;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ success: false, data: null, error: 'Task not found' });

    // ISSUE 5: participation check
    const active = await isActiveParticipant(userId, task.cycleId);
    if (!active) {
      return res.status(403).json({ success: false, data: null, error: 'Must be an active cycle participant' });
    }

    const onLeave = await isUserOnLeave(userId, task.cycleId);
    if (onLeave) {
      return res.status(403).json({ success: false, data: null, error: 'Cannot update tasks while on leave' });
    }

    // Use claimTask which enforces maxAssignments
    const assignment = await claimTask(userId, taskId);
    res.json({ success: true, data: assignment, error: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update task';
    res.status(500).json({ success: false, data: null, error: msg });
  }
});

export default router;
