import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { requireAgreement } from '../middleware/requireAgreement';
import { OwnershipService } from '../services/ownershipService';

const router = Router();

// All ownership/earnings routes require an accepted agreement
router.use(requireAgreement);

// GET /ownership/summary — all cycles for current user
router.get('/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const participations = await prisma.cycleParticipation.findMany({
      where: { userId },
      include: { cycle: true },
    });

    const summary = await Promise.all(
      participations.map(async (p) => {
        const ownership = await OwnershipService.calculateEffectiveOwnership(userId, p.cycleId);
        return { cycle: p.cycle, participation: p, ...ownership };
      })
    );

    res.json({ success: true, data: summary, error: null });
  } catch (error) {
    console.error('Ownership summary error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch ownership summary' });
  }
});

// GET /ownership/effective/:userId/:cycleId — single source of truth
router.get('/effective/:userId/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const cycleId = req.params.cycleId as string;

    if (userId !== req.user!.id && !['admin', 'founder'].includes(req.user!.role)) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied' });
    }

    const data = await OwnershipService.calculateEffectiveOwnership(userId, cycleId);
    res.json({ success: true, data, error: null });
  } catch (error) {
    console.error('Effective ownership error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to calculate effective ownership' });
  }
});

// GET /ownership/:userId/:cycleId — full ownership data with ledger
router.get('/:userId/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const cycleId = req.params.cycleId as string;

    if (userId !== req.user!.id && !['admin', 'founder'].includes(req.user!.role)) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied' });
    }

    const data = await OwnershipService.calculateEffectiveOwnership(userId, cycleId);
    res.json({ success: true, data, error: null });
  } catch (error) {
    console.error('Ownership error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch ownership data' });
  }
});

// GET /ownership/normalized/:userId/:cycleId — normalized ownership % (NEW, non-breaking)
router.get('/normalized/:userId/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.userId as string;
    const cycleId = req.params.cycleId as string;

    if (userId !== req.user!.id && !['admin', 'founder'].includes(req.user!.role)) {
      return res.status(403).json({ success: false, data: null, error: 'Access denied' });
    }

    const data = await OwnershipService.computeNormalizedOwnership(userId, cycleId);
    res.json({ success: true, data, error: null });
  } catch (error) {
    console.error('Normalized ownership error:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to compute normalized ownership' });
  }
});

// GET /ownership/export — CSV/JSON export
router.get('/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = ['admin', 'founder'].includes(req.user!.role);
    const { format = 'json', targetUserId } = req.query;

    // View-only users cannot export
    const accessGrant = await prisma.accessGrant.findFirst({
      where: { userId, type: 'view_only', revokedAt: null },
    });
    if (accessGrant) {
      return res.status(403).json({ success: false, data: null, error: 'Export not allowed for view-only users' });
    }

    const exportUserId = isAdmin && targetUserId ? (targetUserId as string) : userId;

    const entries = await prisma.ownershipLedger.findMany({
      where: { userId: exportUserId },
      orderBy: { createdAt: 'desc' },
      include: { cycle: { select: { name: true } } },
    });

    if (format === 'csv') {
      const header = 'id,cycleId,cycleName,eventType,ownershipAmount,multiplierSnapshot,sourceReference,createdBy,createdAt\n';
      const rows = entries.map(e =>
        `${e.id},${e.cycleId},"${(e.cycle as { name: string }).name}",${e.eventType},${e.ownershipAmount},${e.multiplierSnapshot},${e.sourceReference || ''},${e.createdBy},${e.createdAt.toISOString()}`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ownership_export.csv"');
      return res.send(header + rows);
    }

    res.json({ success: true, data: entries, error: null });
  } catch (error) {
    console.error('Ownership export error:', error);
    res.status(500).json({ success: false, data: null, error: 'Export failed' });
  }
});

export default router;
