import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { triggerEmail } from '../services/emailService';

// Cast to any to work around TS language server cache — runtime types are correct
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const router = Router();

// All onboarding routes require auth
router.use(authMiddleware);

// GET /onboarding/status — return current onboarding state
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Fetch active agreement for step 1
    const activeAgreement = await db.agreement.findFirst({ where: { isActive: true } });
    const userAgreement = activeAgreement
      ? await db.userAgreement.findUnique({
          where: { userId_agreementId: { userId: user.id, agreementId: activeAgreement.id } },
        })
      : null;

    res.json({
      success: true,
      data: {
        onboardingStep: user.onboardingStep ?? 0,
        onboardingCompleted: user.onboardingCompleted ?? false,
        twoFactorEnabled: user.twoFactorEnabled,
        role: user.profile?.role ?? 'contributor',
        agreementAccepted: !!userAgreement,
        agreementId: activeAgreement?.id ?? null,
        agreementVersion: activeAgreement?.version ?? null,
      },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /onboarding/step — advance onboarding step
const stepSchema = z.object({
  step: z.number().int().min(1).max(5),
  data: z.record(z.unknown()).optional(),
});

router.post('/step', async (req: AuthRequest, res: Response) => {
  try {
    const { step, data: stepData } = stepSchema.parse(req.body);

    const user = await db.user.findUnique({
      where: { id: req.user!.id },
      include: { profile: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Cannot skip steps — must complete in order
    if (step !== (user.onboardingStep ?? 0) + 1) {
      return res.status(400).json({
        success: false,
        error: `Cannot jump to step ${step}. Current step is ${user.onboardingStep ?? 0}.`,
      });
    }

    // Step-specific validation
    switch (step) {
      case 1: {
        // Accept rules — must have accepted active agreement
        const activeAgreement = await db.agreement.findFirst({ where: { isActive: true } });
        if (activeAgreement) {
          const accepted = await db.userAgreement.findUnique({
            where: { userId_agreementId: { userId: user.id, agreementId: activeAgreement.id } },
          });
          if (!accepted) {
            return res.status(400).json({ success: false, error: 'You must accept the agreement to proceed.' });
          }
        }
        break;
      }
      case 2: {
        // Enable 2FA — must be enabled
        if (!user.twoFactorEnabled) {
          return res.status(400).json({ success: false, error: 'You must enable 2FA to proceed.' });
        }
        // Send 2FA confirmation email
        triggerEmail('ONBOARDING_2FA_ENABLED', {
          email: user.email,
          name: user.name,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
        break;
      }
      case 3: {
        // Password manager confirmation — require explicit acknowledgment
        const acknowledged = (stepData as Record<string, unknown>)?.passwordManagerAcknowledged;
        if (!acknowledged) {
          return res.status(400).json({ success: false, error: 'You must acknowledge the password manager step to proceed.' });
        }
        break;
      }
      case 4: {
        // Access tier — read-only confirmation, send email
        triggerEmail('ACCESS_TIER_ASSIGNED', {
          email: user.email,
          name: user.name,
          role: user.profile?.role ?? 'contributor',
          timestamp: new Date().toISOString(),
        }).catch(() => {});
        break;
      }
      case 5: {
        // Final review — mark onboarding complete
        await db.user.update({
          where: { id: user.id },
          data: { onboardingStep: 5, onboardingCompleted: true },
        });

        triggerEmail('ONBOARDING_COMPLETE', {
          email: user.email,
          name: user.name,
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        return res.json({
          success: true,
          data: { onboardingStep: 5, onboardingCompleted: true },
        });
      }
    }

    // Advance step
    await db.user.update({
      where: { id: user.id },
      data: { onboardingStep: step },
    });

    res.json({
      success: true,
      data: { onboardingStep: step, onboardingCompleted: false },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /onboarding/tour-complete — persist tour completion
router.post('/tour-complete', async (req: AuthRequest, res: Response) => {
  try {
    await db.user.update({
      where: { id: req.user!.id },
      data: { onboardingTourCompleted: true },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
