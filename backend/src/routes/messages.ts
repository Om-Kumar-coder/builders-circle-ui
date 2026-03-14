import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const router = Router();

// ─── SSE: per-cycle real-time stream ────────────────────────────────────────
// Map of cycleId → Set of SSE response objects
const sseClients = new Map<string, Set<Response>>();

function broadcastToCycle(cycleId: string, event: string, data: unknown) {
  const clients = sseClients.get(cycleId);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { /* client disconnected */ }
  }
}

router.get('/cycle/:cycleId/stream', authMiddleware, async (req: AuthRequest, res: Response) => {
  const cycleId = req.params.cycleId as string;

  // Must be a participant
  const participation = await prisma.cycleParticipation.findUnique({
    where: { userId_cycleId: { userId: req.user!.id, cycleId } }
  });
  if (!participation) {
    return res.status(403).json({ success: false, error: 'Must be participating in cycle to stream messages' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Register client
  if (!sseClients.has(cycleId)) sseClients.set(cycleId, new Set());
  sseClients.get(cycleId)!.add(res);

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(cycleId)?.delete(res);
    if (sseClients.get(cycleId)?.size === 0) sseClients.delete(cycleId);
  });
});

// ─── Schemas ─────────────────────────────────────────────────────────────────
const createMessageSchema = z.object({
  cycleId: z.string(),
  message: z.string().min(1).max(1000),
  mentions: z.array(z.string()).optional().default([]),
});

const editMessageSchema = z.object({
  message: z.string().min(1).max(1000),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isFounder(req: AuthRequest) {
  return req.user?.role === 'founder';
}

async function formatMessage(msg: {
  id: string; cycleId: string; authorId: string; message: string;
  editedAt: Date | null; createdAt: Date; updatedAt: Date;
  author: { id: string; name: string | null; email: string; profile: { avatar: string | null } | null };
  mentionedUsers: { userId: string }[];
  reads: { userId: string }[];
}) {
  return {
    ...msg,
    mentions: msg.mentionedUsers.map(m => m.userId),
    readBy: msg.reads.map(r => r.userId),
  };
}

const messageInclude = {
  author: {
    select: { id: true, name: true, email: true, profile: { select: { avatar: true } } }
  },
  mentionedUsers: { select: { userId: true } },
  reads: { select: { userId: true } },
};

// ─── GET /cycle/:cycleId — fetch last 50 messages ────────────────────────────
router.get('/cycle/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cycleId = req.params.cycleId as string;

    const participation = await prisma.cycleParticipation.findUnique({
      where: { userId_cycleId: { userId: req.user!.id, cycleId } }
    });
    if (!participation) {
      return res.status(403).json({ success: false, error: 'Must be participating in cycle to view messages' });
    }

    const messages = await db.cycleMessage.findMany({
      where: { cycleId },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Mark all fetched messages as read for this user
    const messageIds: string[] = messages.map((m: { id: string }) => m.id);
    if (messageIds.length > 0) {
      await Promise.all(
        messageIds.map((messageId: string) =>
          db.messageRead.upsert({
            where: { messageId_userId: { messageId, userId: req.user!.id } },
            update: {},
            create: { messageId, userId: req.user!.id },
          }).catch(() => { /* ignore duplicate */ })
        )
      );
    }

    const formatted = await Promise.all(messages.map(formatMessage));
    res.json({ success: true, data: formatted.reverse(), error: null });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// ─── POST / — send a message ─────────────────────────────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = createMessageSchema.parse(req.body);

    const participation = await prisma.cycleParticipation.findUnique({
      where: { userId_cycleId: { userId: req.user!.id, cycleId: data.cycleId } }
    });
    if (!participation) {
      return res.status(403).json({ success: false, error: 'Must be participating in cycle to send messages' });
    }

    // Validate mentioned users are in the cycle
    if (data.mentions.length > 0) {
      const mentionedParticipations = await prisma.cycleParticipation.findMany({
        where: { cycleId: data.cycleId, userId: { in: data.mentions } }
      });
      if (mentionedParticipations.length !== data.mentions.length) {
        return res.status(400).json({ success: false, error: 'Some mentioned users are not participating in this cycle' });
      }
    }

    const message = await db.cycleMessage.create({
      data: {
        cycleId: data.cycleId,
        authorId: req.user!.id,
        message: data.message,
        mentions: JSON.stringify(data.mentions), // legacy field
        mentionedUsers: data.mentions.length > 0
          ? { create: data.mentions.map((userId: string) => ({ userId })) }
          : undefined,
        // Auto-mark as read for the sender
        reads: { create: { userId: req.user!.id } },
      },
      include: messageInclude,
    });

    // Notify mentioned users
    for (const mentionedUserId of data.mentions) {
      if (mentionedUserId !== req.user!.id) {
        await NotificationService.createNotification(
          mentionedUserId,
          'user_mentioned',
          `${req.user!.email} mentioned you in a cycle discussion`,
          { cycleId: data.cycleId, messageId: message.id, authorId: req.user!.id }
        );
      }
    }

    await updateCycleEngagement(data.cycleId);

    const formatted = await formatMessage(message);

    // Broadcast to SSE clients in this cycle
    broadcastToCycle(data.cycleId, 'new_message', formatted);

    res.status(201).json({ success: true, data: formatted, error: null });
  } catch (error) {
    console.error('Error creating message:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: `Validation error: ${error.errors.map(e => e.message).join(', ')}` });
    }
    res.status(500).json({ success: false, error: 'Failed to create message' });
  }
});

// ─── PATCH /:messageId — edit a message (founder only) ───────────────────────
router.patch('/:messageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!isFounder(req)) {
      return res.status(403).json({ success: false, error: 'Only founders can edit messages' });
    }

    const { messageId } = req.params;
    const data = editMessageSchema.parse(req.body);

    const existing = await db.cycleMessage.findUnique({
      where: { id: messageId },
      select: { id: true, cycleId: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    const updated = await db.cycleMessage.update({
      where: { id: messageId },
      data: { message: data.message, editedAt: new Date() },
      include: messageInclude,
    });

    const formatted = await formatMessage(updated);
    broadcastToCycle(existing.cycleId, 'edit_message', formatted);

    res.json({ success: true, data: formatted, error: null });
  } catch (error) {
    console.error('Error editing message:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: `Validation error: ${error.errors.map(e => e.message).join(', ')}` });
    }
    res.status(500).json({ success: false, error: 'Failed to edit message' });
  }
});

// ─── DELETE /:messageId — delete a message (founder only) ────────────────────
router.delete('/:messageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!isFounder(req)) {
      return res.status(403).json({ success: false, error: 'Only founders can delete messages' });
    }

    const { messageId } = req.params;
    const message = await db.cycleMessage.findUnique({
      where: { id: messageId },
      select: { id: true, cycleId: true },
    });
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    await db.cycleMessage.delete({ where: { id: messageId } });

    broadcastToCycle(message.cycleId, 'delete_message', { id: messageId });

    res.json({ success: true, data: null, error: null });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// ─── POST /:messageId/read — mark a single message read ──────────────────────
router.post('/:messageId/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    await db.messageRead.upsert({
      where: { messageId_userId: { messageId, userId: req.user!.id } },
      update: {},
      create: { messageId, userId: req.user!.id },
    });
    res.json({ success: true, data: null, error: null });
  } catch (error) {
    console.error('Error marking message read:', error);
    res.status(500).json({ success: false, error: 'Failed to mark message as read' });
  }
});

// ─── GET /unread-count — true unread count via MessageRead ───────────────────
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participations = await prisma.cycleParticipation.findMany({
      where: { userId: req.user!.id, optedIn: true },
      select: { cycleId: true },
    });

    const cycleIds = participations.map(p => p.cycleId);
    if (cycleIds.length === 0) {
      return res.json({ success: true, data: { count: 0 }, error: null });
    }

    // Count messages in user's cycles that the user has NOT read and didn't author
    const count = await db.cycleMessage.count({
      where: {
        cycleId: { in: cycleIds },
        authorId: { not: req.user!.id },
        reads: { none: { userId: req.user!.id } },
      },
    });

    res.json({ success: true, data: { count }, error: null });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
});

// ─── GET /mentions — messages where current user is mentioned ─────────────────
router.get('/mentions', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mentions = await db.messageMention.findMany({
      where: { userId: req.user!.id },
      include: {
        message: {
          include: messageInclude,
        },
      },
      orderBy: { message: { createdAt: 'desc' } },
      take: 20,
    });

    const formatted = await Promise.all(
      mentions.map((m: { message: Parameters<typeof formatMessage>[0] }) => formatMessage(m.message))
    );
    res.json({ success: true, data: formatted, error: null });
  } catch (error) {
    console.error('Error fetching mentions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch mentions' });
  }
});

// ─── Helper: update cycle engagement ─────────────────────────────────────────
async function updateCycleEngagement(cycleId: string) {
  try {
    const [activityCount, verifiedActivities, participantCount, messageCount] = await Promise.all([
      prisma.activityEvent.count({ where: { cycleId } }),
      prisma.activityEvent.count({ where: { cycleId, status: 'verified' } }),
      prisma.cycleParticipation.count({ where: { cycleId, optedIn: true } }),
      db.cycleMessage.count({ where: { cycleId } }),
    ]);

    const participationRate = participantCount > 0
      ? (await prisma.cycleParticipation.count({ where: { cycleId, stallStage: 'active' } })) / participantCount
      : 0;

    const verifiedActivityRatio = activityCount > 0 ? verifiedActivities / activityCount : 0;
    const engagementScore = Math.min(100,
      (activityCount * 0.4) + (participationRate * 30) + (verifiedActivityRatio * 20) + (messageCount * 0.1)
    );

    await db.cycleEngagement.upsert({
      where: { cycleId },
      update: { engagementScore, activityCount, participationRate, verifiedActivityRatio, messageCount, updatedAt: new Date() },
      create: { cycleId, engagementScore, activityCount, participationRate, verifiedActivityRatio, messageCount },
    });
  } catch (error) {
    console.error('Error updating cycle engagement:', error);
  }
}

export default router;
