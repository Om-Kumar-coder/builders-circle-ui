import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/groups/my — current user's group
router.get('/my', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { group: true },
    });
    res.json({ success: true, data: user?.group ?? null, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch group' });
  }
});

// GET /api/admin/groups — list all groups with user count
router.get('/admin', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: AuthRequest, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { users: true, tasks: true } },
      },
    });
    res.json({ success: true, data: groups, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch groups' });
  }
});

// POST /api/admin/groups — create group
router.post('/admin', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = groupSchema.parse(req.body);
    const group = await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        isDefault: data.isDefault ?? false,
      },
    });
    res.status(201).json({ success: true, data: group, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to create group' });
  }
});

// PATCH /api/admin/groups/:id — update group
router.patch('/admin/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const data = groupSchema.partial().parse(req.body);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const group = await prisma.group.update({ where: { id }, data });
    res.json({ success: true, data: group, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to update group' });
  }
});

// DELETE /api/admin/groups/:id — delete group (only if no users assigned)
router.delete('/admin/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userCount = await prisma.user.count({ where: { groupId: id } });
    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Cannot delete group: ${userCount} user${userCount > 1 ? 's' : ''} still assigned`,
      });
    }
    // Null out task groupId before deleting
    await prisma.task.updateMany({ where: { groupId: id }, data: { groupId: null } });
    await prisma.group.delete({ where: { id } });
    res.json({ success: true, data: null, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to delete group' });
  }
});

// PATCH /api/admin/users/:id/group — assign user to group
router.patch('/admin/users/:id/group', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { groupId } = z.object({ groupId: z.string().nullable() }).parse(req.body);
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { groupId },
      select: { id: true, email: true, name: true, groupId: true },
    });
    res.json({ success: true, data: user, error: null });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: err.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to assign group' });
  }
});

export default router;
