import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

type LogType = 'ownership' | 'admin' | 'security' | 'participation';

/**
 * GET /logs
 * Unified log endpoint. Admins see all; users see their own.
 * Query: userId, type (ownership|admin|security|participation), startDate, endDate, page, limit
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'founder'].includes(req.user!.role);
    const {
      userId: qUserId,
      type,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const targetUserId = isAdmin && qUserId ? (qUserId as string) : req.user!.id;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)));
    const skip = (pageNum - 1) * limitNum;

    const dateFilter = {
      ...(startDate ? { gte: new Date(startDate as string) } : {}),
      ...(endDate ? { lte: new Date(endDate as string) } : {}),
    };
    const hasDateFilter = startDate || endDate;

    const types: LogType[] = type
      ? [(type as LogType)]
      : ['ownership', 'admin', 'security', 'participation'];

    const results: Record<string, unknown[]> = {};

    await Promise.all(
      types.map(async (t) => {
        switch (t) {
          case 'ownership': {
            const entries = await prisma.ownershipLedger.findMany({
              where: {
                userId: targetUserId,
                ...(hasDateFilter ? { createdAt: dateFilter } : {}),
              },
              orderBy: { createdAt: 'desc' },
              skip,
              take: limitNum,
              include: { cycle: { select: { name: true } } },
            });
            results.ownership = entries.map(e => ({ ...e, logType: 'ownership' }));
            break;
          }
          case 'admin': {
            if (!isAdmin) { results.admin = []; break; }
            const logs = await prisma.auditTrail.findMany({
              where: {
                ...(hasDateFilter ? { timestamp: dateFilter } : {}),
                ...(qUserId ? { targetUserId: targetUserId } : {}),
              },
              orderBy: { timestamp: 'desc' },
              skip,
              take: limitNum,
              include: {
                admin: { select: { id: true, name: true, email: true } },
                targetUser: { select: { id: true, name: true, email: true } },
              },
            });
            results.admin = logs.map(l => ({ ...l, logType: 'admin' }));
            break;
          }
          case 'security': {
            const events = await prisma.securityEvent.findMany({
              where: {
                userId: targetUserId,
                ...(hasDateFilter ? { createdAt: dateFilter } : {}),
              },
              orderBy: { createdAt: 'desc' },
              skip,
              take: limitNum,
            });
            results.security = events.map(e => ({ ...e, logType: 'security' }));
            break;
          }
          case 'participation': {
            const participations = await prisma.cycleParticipation.findMany({
              where: {
                userId: targetUserId,
                ...(hasDateFilter ? { createdAt: dateFilter } : {}),
              },
              orderBy: { createdAt: 'desc' },
              skip,
              take: limitNum,
              include: { cycle: { select: { id: true, name: true, state: true } } },
            });
            results.participation = participations.map(p => ({ ...p, logType: 'participation' }));
            break;
          }
        }
      })
    );

    // Flatten and sort by date if multiple types
    const flat = Object.values(results).flat().sort((a: unknown, b: unknown) => {
      const aDate = new Date((a as Record<string, unknown>).createdAt as string || (a as Record<string, unknown>).timestamp as string).getTime();
      const bDate = new Date((b as Record<string, unknown>).createdAt as string || (b as Record<string, unknown>).timestamp as string).getTime();
      return bDate - aDate;
    });

    res.json({ success: true, data: { logs: flat, byType: results }, error: null });
  } catch (error) {
    console.error('Logs error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch logs' });
  }
});

/**
 * GET /logs/export
 * Export logs as CSV or JSON. Respects view-only restrictions.
 */
router.get('/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = ['admin', 'founder'].includes(req.user!.role);

    // View-only check
    const viewOnlyGrant = await prisma.accessGrant.findFirst({
      where: { userId, type: 'view_only', revokedAt: null },
    });
    if (viewOnlyGrant) {
      return res.status(403).json({ success: false, data: null, error: 'Export not allowed for view-only users' });
    }

    const { type = 'ownership', format = 'json', targetUserId: qTarget } = req.query;
    const targetUserId = isAdmin && qTarget ? (qTarget as string) : userId;

    let data: unknown[] = [];

    if (type === 'ownership') {
      data = await prisma.ownershipLedger.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        include: { cycle: { select: { name: true } } },
      });
    } else if (type === 'admin' && isAdmin) {
      data = await prisma.auditTrail.findMany({
        orderBy: { timestamp: 'desc' },
        take: 1000,
        include: {
          admin: { select: { id: true, name: true, email: true } },
          targetUser: { select: { id: true, name: true, email: true } },
        },
      });
    } else if (type === 'security') {
      data = await prisma.securityEvent.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
      });
    } else if (type === 'participation') {
      data = await prisma.cycleParticipation.findMany({
        where: { userId: targetUserId },
        orderBy: { createdAt: 'desc' },
        include: { cycle: { select: { id: true, name: true } } },
      });
    }

    if (format === 'csv') {
      const keys = data.length > 0 ? Object.keys(data[0] as object).filter(k => typeof (data[0] as Record<string, unknown>)[k] !== 'object') : [];
      const header = keys.join(',') + '\n';
      const rows = data.map(row =>
        keys.map(k => {
          const val = (row as Record<string, unknown>)[k];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(',')
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
      return res.send(header + rows);
    }

    res.json({ success: true, data, error: null });
  } catch (error) {
    console.error('Log export error:', error);
    res.status(500).json({ success: false, data: null, error: 'Export failed' });
  }
});

/**
 * GET /logs/access-requests — list access requests (admin sees all, user sees own)
 */
router.get('/access-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = ['admin', 'founder'].includes(req.user!.role);
    const where = isAdmin ? {} : { userId: req.user!.id };

    const requests = await prisma.systemLog.findMany({
      where: { ...where, event: 'access_request' },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({ success: true, data: requests, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch access requests' });
  }
});

/**
 * POST /logs/access-request — user requests access
 */
router.post('/access-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accessType, reason } = req.body as { accessType: string; reason: string };
    if (!accessType || !reason) {
      return res.status(400).json({ success: false, data: null, error: 'accessType and reason are required' });
    }

    const log = await prisma.systemLog.create({
      data: {
        userId: req.user!.id,
        event: 'access_request',
        severity: 'INFO',
        message: `Access request: ${accessType} — ${reason}`,
        metadata: JSON.stringify({ accessType, reason, status: 'pending', requestedAt: new Date() }),
      },
    });

    res.status(201).json({ success: true, data: log, error: null });
  } catch (error) {
    console.error('Access request error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to submit access request' });
  }
});

/**
 * PATCH /logs/access-request/:id — admin approves/rejects
 */
router.patch('/access-request/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body as { status: 'approved' | 'rejected' };
    const id = req.params.id as string;

    const existing = await prisma.systemLog.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, data: null, error: 'Request not found' });

    const meta = JSON.parse(existing.metadata || '{}');
    const updated = await prisma.systemLog.update({
      where: { id },
      data: { metadata: JSON.stringify({ ...meta, status, reviewedBy: req.user!.id, reviewedAt: new Date() }) },
    });

    // If approved, create an access grant
    if (status === 'approved' && existing.userId) {
      await prisma.accessGrant.create({
        data: {
          userId: existing.userId,
          grantedBy: req.user!.id,
          type: meta.accessType,
          value: meta.reason,
        },
      });
    }

    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    console.error('Access request review error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to update access request' });
  }
});

export default router;
