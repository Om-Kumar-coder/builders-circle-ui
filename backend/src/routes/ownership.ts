import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get ownership data for user in a cycle
router.get('/:userId/:cycleId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    const cycleId = Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId;

    // Users can only view their own ownership unless they're admin
    if (userId !== req.user!.id && !['admin', 'founder'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all ownership ledger entries
    const ledgerEntries = await prisma.ownershipLedger.findMany({
      where: {
        userId,
        cycleId
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total ownership
    const totalOwnership = ledgerEntries.reduce((sum, entry) => sum + entry.ownershipAmount, 0);

    // Get latest multiplier
    const latestMultiplier = await prisma.multiplier.findFirst({
      where: {
        userId,
        cycleId
      },
      orderBy: { createdAt: 'desc' }
    });

    const multiplier = latestMultiplier?.multiplier || 1.0;
    const effectiveOwnership = totalOwnership * multiplier;

    res.json({
      success: true,
      totalOwnership,
      multiplier,
      effectiveOwnership,
      entriesCount: ledgerEntries.length,
      entries: ledgerEntries
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ownership summary for all cycles (current user)
router.get('/summary', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get all cycles user has participated in
    const participations = await prisma.cycleParticipation.findMany({
      where: { userId },
      include: {
        cycle: true
      }
    });

    const ownershipSummary = await Promise.all(
      participations.map(async (participation) => {
        const ledgerEntries = await prisma.ownershipLedger.findMany({
          where: {
            userId,
            cycleId: participation.cycleId
          }
        });

        const totalOwnership = ledgerEntries.reduce((sum, entry) => sum + entry.ownershipAmount, 0);

        const latestMultiplier = await prisma.multiplier.findFirst({
          where: {
            userId,
            cycleId: participation.cycleId
          },
          orderBy: { createdAt: 'desc' }
        });

        const multiplier = latestMultiplier?.multiplier || 1.0;
        const effectiveOwnership = totalOwnership * multiplier;

        return {
          cycle: participation.cycle,
          participation,
          totalOwnership,
          multiplier,
          effectiveOwnership,
          entriesCount: ledgerEntries.length
        };
      })
    );

    res.json(ownershipSummary);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;