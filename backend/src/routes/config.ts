import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Foundation Phase config ───────────────────────────────────────────────────
// Stored in a dedicated SystemLog entry keyed by event='foundation_phase_config'.
// Falls back to env var FOUNDATION_PHASE_ENABLED=true if no DB record exists.

async function getFoundationPhaseEnabled(): Promise<boolean> {
  try {
    const log = await prisma.systemLog.findFirst({
      where: { event: 'foundation_phase_config' },
      orderBy: { timestamp: 'desc' },
    });
    if (log?.metadata) {
      const parsed = JSON.parse(log.metadata) as { enabled?: boolean };
      if (typeof parsed.enabled === 'boolean') return parsed.enabled;
    }
  } catch {
    // ignore — fall through to env
  }
  return process.env.FOUNDATION_PHASE_ENABLED === 'true';
}

// GET /api/admin/config/foundation-phase
router.get('/foundation-phase', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: AuthRequest, res: Response) => {
  try {
    const enabled = await getFoundationPhaseEnabled();
    res.json({ success: true, data: { foundationPhaseEnabled: enabled }, error: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch config.' });
  }
});

// PATCH /api/admin/config/foundation-phase — founder only
router.patch('/foundation-phase', authMiddleware, roleMiddleware(['founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    // Write config as a SystemLog entry (no schema migration needed)
    await prisma.systemLog.create({
      data: {
        event: 'foundation_phase_config',
        severity: 'INFO',
        message: `Foundation Phase ${enabled ? 'enabled' : 'disabled'} by founder ${req.user!.id}`,
        userId: req.user!.id,
        metadata: JSON.stringify({ enabled }),
      },
    });

    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'foundation_phase_toggle',
        targetUserId: req.user!.id,
        previousValue: null,
        newValue: JSON.stringify({ foundationPhaseEnabled: enabled }),
        reason: `Foundation phase ${enabled ? 'enabled' : 'disabled'} by founder`,
        timestamp: new Date(),
      },
    });

    res.json({ success: true, data: { foundationPhaseEnabled: enabled }, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, data: null, error: error.errors[0].message });
    }
    res.status(500).json({ success: false, data: null, error: 'Failed to update config.' });
  }
});

export { getFoundationPhaseEnabled };
export default router;
