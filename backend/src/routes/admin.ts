/* eslint-disable @typescript-eslint/no-unused-vars */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { JobScheduler } from '../jobs/scheduler';

const router = Router();

// Get audit logs (admin only)
router.get('/audit', authMiddleware, roleMiddleware(['admin', 'founder']), async (_req: Request, res: Response) => {
  try {
    const auditLogs = await prisma.auditTrail.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        targetUser: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: auditLogs,
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

// Resolve dispute (admin only)
router.post('/resolve-dispute', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
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

// Update user role (admin only)
router.patch('/users/:id/role', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      role: z.enum(['founder', 'admin', 'contributor', 'employee', 'observer'])
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
router.post('/cycles/:id/finalize', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
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
router.post('/override/ownership', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cycleId: z.string(),
      ownershipAmount: z.number(),
      reason: z.string()
    });

    const { userId, cycleId, ownershipAmount, reason } = schema.parse(req.body);

    // Get current ownership for audit trail
    const currentOwnership = await prisma.ownershipLedger.findMany({
      where: { userId, cycleId }
    });

    // Create ownership adjustment entry
    await prisma.ownershipLedger.create({
      data: {
        userId,
        cycleId,
        eventType: 'admin_override',
        ownershipAmount,
        multiplierSnapshot: 1.0,
        sourceReference: 'admin_override',
        createdBy: req.user!.id
      }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'ownership_override',
        targetUserId: userId,
        previousValue: JSON.stringify({ currentOwnership }),
        newValue: JSON.stringify({ ownershipAmount }),
        reason,
        timestamp: new Date()
      }
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

router.post('/override/multiplier', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cycleId: z.string(),
      multiplier: z.number().min(0).max(2),
      reason: z.string()
    });

    const { userId, cycleId, multiplier, reason } = schema.parse(req.body);

    // Get current multiplier for audit trail
    const currentMultiplier = await prisma.multiplier.findFirst({
      where: { userId, cycleId },
      orderBy: { createdAt: 'desc' }
    });

    // Create new multiplier entry
    await prisma.multiplier.create({
      data: {
        userId,
        cycleId,
        multiplier,
        reason: `Admin override: ${reason}`
      }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'multiplier_restore',
        targetUserId: userId,
        previousValue: JSON.stringify({ multiplier: currentMultiplier?.multiplier || 1.0 }),
        newValue: JSON.stringify({ multiplier }),
        reason,
        timestamp: new Date()
      }
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

router.post('/override/stall-clear', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string(),
      cycleId: z.string(),
      reason: z.string()
    });

    const { userId, cycleId, reason } = schema.parse(req.body);

    // Get current participation for audit trail
    const participation = await prisma.cycleParticipation.findUnique({
      where: { userId_cycleId: { userId, cycleId } }
    });

    if (!participation) {
      return res.status(404).json({ success: false, error: 'Participation not found' });
    }

    // Clear stall status
    await prisma.cycleParticipation.update({
      where: { userId_cycleId: { userId, cycleId } },
      data: {
        stallStage: 'active',
        participationStatus: 'active',
        lastActivityDate: new Date()
      }
    });

    // Restore multiplier to 1.0
    await prisma.multiplier.create({
      data: {
        userId,
        cycleId,
        multiplier: 1.0,
        reason: `Admin stall clear: ${reason}`
      }
    });

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'stall_clear',
        targetUserId: userId,
        previousValue: JSON.stringify({ 
          stallStage: participation.stallStage,
          participationStatus: participation.participationStatus 
        }),
        newValue: JSON.stringify({ 
          stallStage: 'active',
          participationStatus: 'active' 
        }),
        reason,
        timestamp: new Date()
      }
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
router.post('/jobs/execute', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      jobId: z.enum(['stall-evaluator', 'multiplier-adjustment', 'ownership-decay', 'cycle-finalizer'])
    });

    let parsed;
    try {
      parsed = schema.parse(req.body);
    } catch (zodErr) {
      if (zodErr instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: null, error: `Invalid jobId. Must be one of: stall-evaluator, multiplier-adjustment, ownership-decay, cycle-finalizer` });
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

export default router;