import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, stepUpMiddleware, AuthRequest } from '../middleware/auth';
import { JobScheduler } from '../jobs/scheduler';
import { SecurityService } from '../services/securityService';
import { NotificationService } from '../services/notificationService';
import accessControlRoutes from './accessControl';

const router = Router();

// Get audit logs (admin only)
// Query params: action, adminSearch (name/email), targetSearch (name/email/id), startDate, endDate, page, limit
router.get('/audit', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: Request, res: Response) => {
  try {
    const {
      action,
      adminSearch,
      targetSearch,
      startDate,
      endDate,
      page = '1',
      limit = '25',
    } = req.query as Record<string, string>;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));

    // Resolve adminSearch → matching user IDs (name or email, case-insensitive)
    let adminIds: string[] | undefined;
    if (adminSearch?.trim()) {
      const s = adminSearch.trim();
      const matched = await prisma.user.findMany({
        where: {
          OR: [
            { name:  { contains: s } },
            { email: { contains: s } },
          ],
        },
        select: { id: true },
      });
      adminIds = matched.map(u => u.id);
      // No matching users → guaranteed empty result set
      if (adminIds.length === 0) {
        return res.json({
          success: true,
          data: { logs: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
          error: null,
        });
      }
    }

    // Resolve targetSearch → matching user IDs (name, email, or exact id)
    let targetIds: string[] | undefined;
    if (targetSearch?.trim()) {
      const s = targetSearch.trim();
      const matched = await prisma.user.findMany({
        where: {
          OR: [
            { id:    s },
            { name:  { contains: s } },
            { email: { contains: s } },
          ],
        },
        select: { id: true },
      });
      targetIds = matched.map(u => u.id);
      if (targetIds.length === 0) {
        return res.json({
          success: true,
          data: { logs: [], total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
          error: null,
        });
      }
    }

    // Build Prisma where clause
    const where: Record<string, unknown> = {};
    if (action)    where.action   = action;
    if (adminIds)  where.adminId  = { in: adminIds };
    if (targetIds) where.targetUserId = { in: targetIds };
    if (startDate || endDate) {
      where.timestamp = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate   ? { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) } : {}),
      };
    }

    const [total, auditLogs] = await Promise.all([
      prisma.auditTrail.count({ where }),
      prisma.auditTrail.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          admin:      { select: { id: true, email: true, name: true } },
          targetUser: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: { logs: auditLogs, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      error: null,
    });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: 'Internal server error' });
  }
});

// Resolve dispute (admin only)
router.post('/resolve-dispute', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      disputeId: z.string(),
      status: z.enum(['approved', 'denied']),
      resolution: z.string()
    });

    const { disputeId, status, resolution } = schema.parse(req.body);

    // Update dispute
    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution,
        resolvedAt: new Date(),
        resolvedBy: req.user!.id
      }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'dispute_resolution',
        targetUserId: dispute.userId,
        previousValue: JSON.stringify({ status: 'pending' }),
        newValue: JSON.stringify({ status, resolution }),
        reason: `Dispute resolved: ${resolution}`,
        timestamp: new Date()
      }
    });

    res.json({
      success: true,
      data: { message: 'Dispute resolved successfully', dispute },
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.issues
      });
    }
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error'
    });
  }
});

// Get admin stats (admin only)
router.get('/stats', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const [userCount, cycleCount, activityCount, participationCount] = await Promise.all([
      prisma.user.count(),
      prisma.buildCycle.count(),
      prisma.activityEvent.count(),
      prisma.cycleParticipation.count({ where: { optedIn: true } })
    ]);

    res.json({
      success: true,
      data: {
        userCount,
        cycleCount,
        activityCount,
        participationCount
      },
      error: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error'
    });
  }
});

// Get all users (admin only)
router.get('/users', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        profile: true,
        cycleParticipations: {
          include: {
            cycle: {
              select: {
                id: true,
                name: true,
                state: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: users,
      error: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error'
    });
  }
});

// Delete user (founder only) — cascades all related data
router.delete('/users/:id', authMiddleware, roleMiddleware(['founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Prevent self-deletion
    if (userId === req.user!.id) {
      return res.status(400).json({ success: false, data: null, error: 'You cannot delete your own account.' });
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
    if (!target) return res.status(404).json({ success: false, data: null, error: 'User not found.' });

    // Audit before deletion (record is gone after)
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'user_deleted',
        targetUserId: userId,
        previousValue: JSON.stringify({ email: target.email, name: target.name }),
        newValue: null,
        reason: `User deleted by founder ${req.user!.id}`,
        timestamp: new Date(),
      },
    });

    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true, data: { message: `User ${target.email} deleted.` }, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: 'Failed to delete user.' });
  }
});

// Update user role (admin only)
router.patch('/users/:id/role', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      role: z.enum(['founder', 'admin', 'gatekeeper', 'contributor', 'employee', 'observer'])
    });

    const { role } = schema.parse(req.body);
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const profile = await prisma.userProfile.update({
      where: { userId },
      data: { role }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'role_change',
        targetUserId: userId,
        previousValue: JSON.stringify({ role: 'previous_role' }),
        newValue: JSON.stringify({ role }),
        reason: `Role changed to ${role}`,
        timestamp: new Date()
      }
    });

    // Security alert to the affected user
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (targetUser) {
      await NotificationService.createNotification(
        userId,
        'security_alert',
        `Your account role was changed to "${role}" by an admin.`,
        { eventType: 'role_change', newRole: role, changedBy: req.user!.id, changedAt: new Date().toISOString() },
      ).catch(() => {});
      await SecurityService.recordEvent(userId, 'role_change', {
        ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      }, { eventType: 'role_change', newRole: role, changedBy: req.user!.id }).catch(() => {});
    }

    res.json({
      success: true,
      data: { message: 'User role updated successfully', profile },
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.issues
      });
    }
    res.status(500).json({
      success: false,
      data: null,
      error: 'Internal server error'
    });
  }
});

// Manual cycle finalization (admin only)
router.post('/cycles/:id/finalize', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    console.log(`Admin ${req.user!.email} manually finalizing cycle ${cycleId}`);
    await JobScheduler.finalizeCycle(cycleId);
    
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'manual_cycle_finalization',
        targetUserId: req.user!.id,
        previousValue: null,
        newValue: JSON.stringify({ cycleId }),
        reason: `Manual finalization of cycle ${cycleId}`,
        timestamp: new Date()
      }
    });

    res.json({
      success: true,
      data: { message: 'Cycle finalized successfully' },
      error: null
    });
  } catch (error) {
    console.error('Manual cycle finalization failed:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Cycle finalization failed'
    });
  }
});

// Get accountability system status (admin only)
router.get('/accountability/status', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    // Get system-wide accountability stats
    const [
      totalParticipants,
      graceParticipants,
      activeParticipants,
      atRiskParticipants,
      diminishingParticipants,
      pausedParticipants,
      recentDecayEvents,
      recentRecoveries
    ] = await Promise.all([
      prisma.cycleParticipation.count({ where: { optedIn: true } }),
      prisma.cycleParticipation.count({ where: { optedIn: true, stallStage: 'grace' } }),
      prisma.cycleParticipation.count({ where: { optedIn: true, stallStage: 'active' } }),
      prisma.cycleParticipation.count({ where: { optedIn: true, stallStage: 'at_risk' } }),
      prisma.cycleParticipation.count({ where: { optedIn: true, stallStage: 'diminishing' } }),
      prisma.cycleParticipation.count({ where: { optedIn: true, stallStage: 'paused' } }),
      prisma.ownershipLedger.count({
        where: {
          eventType: 'ownership_decay',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.ownershipLedger.count({
        where: {
          eventType: 'multiplier_recovery',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalParticipants,
        stallStageDistribution: {
          grace: graceParticipants,
          active: activeParticipants,
          at_risk: atRiskParticipants,
          diminishing: diminishingParticipants,
          paused: pausedParticipants
        },
        recentActivity: {
          decayEvents: recentDecayEvents,
          recoveries: recentRecoveries
        }
      },
      error: null
    });
  } catch (error) {
    console.error('Error fetching accountability status:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch accountability status'
    });
  }
});

// Admin override endpoints
router.post('/override/ownership', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cycleId: z.string(),
      ownershipAmount: z.number(),
      reason: z.string()
    });

    const { userId, cycleId, ownershipAmount, reason } = schema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      const latestMultiplier = await tx.multiplier.findFirst({
        where: { userId, cycleId },
        orderBy: { createdAt: 'desc' },
      });
      const multiplierSnapshot = latestMultiplier?.multiplier ?? 1.0;

      await tx.ownershipLedger.create({
        data: {
          userId,
          cycleId,
          eventType: 'admin_override',
          ownershipAmount,
          multiplierSnapshot,
          sourceReference: 'admin_override',
          createdBy: req.user!.id,
        },
      });

      await tx.auditTrail.create({
        data: {
          adminId: req.user!.id,
          action: 'ownership_override',
          targetUserId: userId,
          previousValue: null,
          newValue: JSON.stringify({ ownershipAmount }),
          reason,
          timestamp: new Date(),
        },
      });
    });

    res.json({
      success: true,
      data: { message: 'Ownership override applied successfully' },
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/override/multiplier', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cycleId: z.string(),
      multiplier: z.number().min(0).max(2),
      reason: z.string()
    });

    const { userId, cycleId, multiplier, reason } = schema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      const currentMultiplier = await tx.multiplier.findFirst({
        where: { userId, cycleId },
        orderBy: { createdAt: 'desc' },
      });

      await tx.multiplier.create({
        data: { userId, cycleId, multiplier, reason: `Admin override: ${reason}` },
      });

      await tx.auditTrail.create({
        data: {
          adminId: req.user!.id,
          action: 'multiplier_restore',
          targetUserId: userId,
          previousValue: JSON.stringify({ multiplier: currentMultiplier?.multiplier ?? 1.0 }),
          newValue: JSON.stringify({ multiplier }),
          reason,
          timestamp: new Date(),
        },
      });
    });

    res.json({
      success: true,
      data: { message: 'Multiplier override applied successfully' },
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/override/stall-clear', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cycleId: z.string(),
      reason: z.string()
    });

    const { userId, cycleId, reason } = schema.parse(req.body);

    await prisma.$transaction(async (tx) => {
      const participation = await tx.cycleParticipation.findUnique({
        where: { userId_cycleId: { userId, cycleId } },
      });
      if (!participation) throw Object.assign(new Error('Participation not found'), { code: 'NOT_FOUND' });

      await tx.cycleParticipation.update({
        where: { userId_cycleId: { userId, cycleId } },
        data: { stallStage: 'active', participationStatus: 'active', lastActivityDate: new Date() },
      });

      await tx.multiplier.create({
        data: { userId, cycleId, multiplier: 1.0, reason: `Admin stall clear: ${reason}` },
      });

      await tx.auditTrail.create({
        data: {
          adminId: req.user!.id,
          action: 'stall_clear',
          targetUserId: userId,
          previousValue: JSON.stringify({ stallStage: participation.stallStage, participationStatus: participation.participationStatus }),
          newValue: JSON.stringify({ stallStage: 'active', participationStatus: 'active' }),
          reason,
          timestamp: new Date(),
        },
      });
    });

    res.json({
      success: true,
      data: { message: 'Stall status cleared successfully' },
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.issues });
    }
    if ((error as { code?: string }).code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Participation not found' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get disputes (admin only)
router.get('/disputes', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const disputes = await prisma.dispute.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        activity: {
          select: {
            id: true,
            activityType: true,
            description: true,
            proofLink: true,
            status: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: disputes,
      error: null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Generic manual job execution endpoint
router.post('/jobs/execute', authMiddleware, roleMiddleware(['admin', 'founder']), stepUpMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      jobId: z.enum(['stall-evaluator', 'multiplier-adjustment', 'ownership-decay', 'cycle-finalizer', 'score-computation', 'aggregation', 'normalization'])
    });

    let parsed;
    try {
      parsed = schema.parse(req.body);
    } catch (zodErr) {
      if (zodErr instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: null, error: `Invalid jobId. Must be one of: stall-evaluator, multiplier-adjustment, ownership-decay, cycle-finalizer, score-computation, aggregation, normalization` });
      }
      throw zodErr;
    }
    const { jobId } = parsed;
    
    console.log(`Admin ${req.user!.email} manually triggered ${jobId} job`);
    
    let jobResult: string;
    switch (jobId) {
      case 'stall-evaluator':
        await JobScheduler.runStallEvaluator();
        jobResult = 'Stall evaluator job completed successfully';
        break;
      case 'multiplier-adjustment':
        await JobScheduler.runMultiplierAdjustment();
        jobResult = 'Multiplier adjustment job completed successfully';
        break;
      case 'ownership-decay':
        await JobScheduler.runOwnershipDecay();
        jobResult = 'Ownership decay job completed successfully';
        break;
      case 'cycle-finalizer':
        await JobScheduler.runCycleFinalizer();
        jobResult = 'Cycle finalizer job completed successfully';
        break;
      case 'score-computation':
        await JobScheduler.runScoreComputation();
        jobResult = 'Score computation job completed successfully';
        break;
      case 'aggregation':
        await JobScheduler.runAggregation();
        jobResult = 'Aggregation job completed successfully';
        break;
      case 'normalization':
        await JobScheduler.runNormalization();
        jobResult = 'Normalization job completed successfully';
        break;
      default:
        throw new Error(`Unknown job: ${jobId}`);
    }
    
    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'manual_job_execution',
        targetUserId: req.user!.id,
        previousValue: null,
        newValue: JSON.stringify({ job: jobId }),
        reason: `Manual ${jobId} job execution`,
        timestamp: new Date()
      }
    });

    res.json({
      success: true,
      data: { message: jobResult },
      message: jobResult,
      error: null
    });
  } catch (error) {
    console.error('Manual job execution failed:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: null,
      error: error instanceof Error ? error.message : 'Job execution failed'
    });
  }
});

// Send password reset email for a user (admin only)
router.post('/users/:id/send-reset', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!target) {
      return res.status(404).json({ success: false, data: null, error: 'User not found.' });
    }

    const crypto = await import('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken: hashedToken, passwordResetExpiry: expiry },
    });

    const { EmailService } = await import('../services/emailService');
    EmailService.sendPasswordResetEmail(target.email, target.name ?? null, resetToken).catch(
      (err: unknown) => console.error('Failed to send admin-triggered reset email:', err)
    );

    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'admin_password_reset_sent',
        targetUserId: userId,
        previousValue: null,
        newValue: JSON.stringify({ email: target.email }),
        reason: `Admin triggered password reset for ${target.email}`,
        timestamp: new Date(),
      },
    });

    res.json({ success: true, data: { message: `Password reset email sent to ${target.email}.` }, error: null });
  } catch (error) {
    console.error('Admin send-reset failed:', error);
    res.status(500).json({ success: false, data: null, error: 'Failed to send reset email.' });
  }
});

// Mount access control routes under the same admin router
router.use('/', accessControlRoutes);

export default router;