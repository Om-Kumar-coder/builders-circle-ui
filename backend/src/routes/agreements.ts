import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { triggerEmail } from '../services/emailService';

const router = Router();

// ── GET /agreements/current ───────────────────────────────────────────────────
router.get('/current', async (_req, res: Response) => {
  try {
    const agreement = await prisma.agreement.findFirst({ where: { isActive: true } });
    if (!agreement) return res.status(404).json({ error: 'No active agreement found' });
    res.json({ success: true, data: agreement });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /agreements/history ───────────────────────────────────────────────────
router.get('/history', authMiddleware, async (_req, res: Response) => {
  try {
    const agreements = await prisma.agreement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: agreements });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /agreements/user-status ───────────────────────────────────────────────
router.get('/user-status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const active = await prisma.agreement.findFirst({ where: { isActive: true } });
    if (!active) {
      return res.json({ success: true, data: { hasAccepted: true, acceptedVersion: null } });
    }

    const record = await prisma.userAgreement.findUnique({
      where: { userId_agreementId: { userId: req.user!.id, agreementId: active.id } },
    });

    res.json({
      success: true,
      data: {
        hasAccepted: !!record,
        acceptedVersion: record ? active.version : null,
        currentVersion: active.version,
        agreementId: active.id,
      },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /agreements/accept ───────────────────────────────────────────────────
const acceptSchema = z.object({ agreementId: z.string() });

router.post('/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { agreementId } = acceptSchema.parse(req.body);

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    const record = await prisma.userAgreement.upsert({
      where: { userId_agreementId: { userId: req.user!.id, agreementId } },
      update: {
        acceptedAt: new Date(),
        ipAddress: req.ip ?? null,
        userAgent: req.get('User-Agent') ?? null,
      },
      create: {
        userId: req.user!.id,
        agreementId,
        ipAddress: req.ip ?? null,
        userAgent: req.get('User-Agent') ?? null,
      },
    });

    res.json({ success: true, data: record });

    // Fire agreement accepted email (non-blocking)
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { email: true, name: true } });
    if (user) {
      triggerEmail('AGREEMENT_ACCEPTED', {
        email: user.email,
        name: user.name,
        agreementVersion: agreement.version,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin: POST /agreements (create new version) ──────────────────────────────
const createSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  setActive: z.boolean().optional().default(false),
});

router.post('/', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { version, title, content, setActive } = createSchema.parse(req.body);

    // Ensure version is unique
    const existing = await prisma.agreement.findUnique({ where: { version } });
    if (existing) return res.status(400).json({ error: 'Version already exists' });

    // If setting active, deactivate all others first
    if (setActive) {
      await prisma.agreement.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }

    const agreement = await prisma.agreement.create({
      data: { version, title, content, isActive: setActive },
    });

    res.status(201).json({ success: true, data: agreement });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin: PATCH /agreements/:id/activate ────────────────────────────────────
router.patch('/:id/activate', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const agreementId = Array.isArray(id) ? id[0] : id;

    const agreement = await prisma.agreement.findUnique({ where: { id: agreementId } });
    if (!agreement) return res.status(404).json({ error: 'Agreement not found' });

    // Deactivate all, then activate this one
    await prisma.agreement.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const updated = await prisma.agreement.update({ where: { id: agreementId }, data: { isActive: true } });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Admin: GET /agreements/acceptance-log ────────────────────────────────────
router.get('/acceptance-log', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req, res: Response) => {
  try {
    const log = await prisma.userAgreement.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        agreement: { select: { version: true, title: true } },
      },
      orderBy: { acceptedAt: 'desc' },
    });
    res.json({ success: true, data: log });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
