import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get user's notifications
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { unread } = req.query;

    const where: any = { userId: req.user!.id };
    if (unread === 'true') {
      where.read = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to 50 most recent
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: {
        id: Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
        userId: req.user!.id // Ensure user can only update their own notifications
      },
      data: {
        read: true
      }
    });

    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user!.id,
        read: false
      },
      data: {
        read: true
      }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user!.id,
        read: false
      }
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;