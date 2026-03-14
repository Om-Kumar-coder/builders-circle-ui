import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth';
import { ReputationService } from '../services/reputationService';

const router = Router();

const createActivitySchema = z.object({
  cycleId: z.string(),
  activityType: z.string(),
  proofLink: z.string().url(),
  description: z.string().optional(),
  hoursLogged: z.number().min(0.1).max(12).optional(),
  workSummary: z.string().optional(),
  taskReference: z.string().optional(),
  contributionType: z.enum(['code', 'documentation', 'review', 'hours_logged', 'meeting', 'research', 'task_completion']).default('code'),
  contributionWeight: z.number().min(0).max(10).default(1.0),
});

const verifyActivitySchema = z.object({
  status: z.enum(['verified', 'rejected', 'changes_requested']),
  rejectionReason: z.string().optional(),
  feedbackComment: z.string().optional(),
  calculatedOwnership: z.number().optional(),
});

// Anti-abuse limits
const ACTIVITY_LIMITS = {
  MAX_ACTIVITIES_PER_DAY: 10,
  MAX_HOURS_PER_DAY: 12,
};

// Check daily limits
async function checkDailyLimits(userId: string): Promise<{ canSubmit: boolean; error?: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayActivities = await prisma.activityEvent.findMany({
    where: {
      userId,
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  // Check activity count limit
  if (todayActivities.length >= ACTIVITY_LIMITS.MAX_ACTIVITIES_PER_DAY) {
    return {
      canSubmit: false,
      error: `Daily limit reached: ${ACTIVITY_LIMITS.MAX_ACTIVITIES_PER_DAY} activities per day`,
    };
  }

  // Check hours limit
  const totalHours = todayActivities.reduce((sum, activity) => sum + (activity.hoursLogged || 0), 0);
  if (totalHours >= ACTIVITY_LIMITS.MAX_HOURS_PER_DAY) {
    return {
      canSubmit: false,
      error: `Daily hours limit reached: ${ACTIVITY_LIMITS.MAX_HOURS_PER_DAY} hours per day`,
    };
  }

  return { canSubmit: true };
}

// Get activities
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    console.log('📋 Fetching activities:', {
      userId: req.user?.id,
      query: req.query
    });

    const { cycleId, userId } = req.query;

    const where: { cycleId?: string; userId?: string } = {};
    
    if (cycleId) where.cycleId = cycleId as string;
    if (userId) where.userId = userId as string;
    
    // If no specific user requested, show only current user's activities
    if (!userId) where.userId = req.user!.id;

    const activities = await prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        },
        verifier: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    console.log('✅ Activities fetched:', {
      count: activities.length,
      where
    });

    res.json({
      success: true,
      data: activities,
      error: null
    });
  } catch (error) {
    console.error('❌ Error fetching activities:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch activities'
    });
  }
});

// Get pending activities for admin review
router.get('/pending', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const activities = await prisma.activityEvent.findMany({
      where: {
        status: 'pending'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: activities,
      error: null
    });
  } catch (error) {
    console.error('❌ Error fetching pending activities:', error);
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to fetch pending activities'
    });
  }
});

// Create activity
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    console.log('🚀 Creating activity:', {
      userId: req.user?.id,
      body: req.body
    });

    const data = createActivitySchema.parse(req.body);

    // Check daily limits
    const limitsCheck = await checkDailyLimits(req.user!.id);
    if (!limitsCheck.canSubmit) {
      return res.status(429).json({
        success: false,
        data: null,
        error: limitsCheck.error
      });
    }

    // Check if cycle exists and is active
    const cycle = await prisma.buildCycle.findUnique({
      where: { id: data.cycleId }
    });

    if (!cycle) {
      console.log('❌ Cycle not found:', data.cycleId);
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Cycle not found'
      });
    }

    if (cycle.state !== 'active') {
      console.log('❌ Cycle not active:', { cycleId: data.cycleId, state: cycle.state });
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Cycle is not active'
      });
    }

    // Check if user is participating in the cycle
    const participation = await prisma.cycleParticipation.findUnique({
      where: {
        userId_cycleId: {
          userId: req.user!.id,
          cycleId: data.cycleId
        }
      }
    });

    if (!participation || !participation.optedIn) {
      console.log('❌ User not participating:', { userId: req.user!.id, cycleId: data.cycleId });
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Must be participating in cycle to submit activities'
      });
    }

    // Get contribution weight from database
    let contributionWeight = data.contributionWeight || 1.0;
    const weightConfig = await prisma.contributionWeight.findUnique({
      where: { contributionType: data.contributionType }
    });
    
    if (weightConfig) {
      contributionWeight = weightConfig.weight;
    }

    // Create activity
    const activity = await prisma.activityEvent.create({
      data: {
        userId: req.user!.id,
        cycleId: data.cycleId,
        activityType: data.activityType,
        proofLink: data.proofLink,
        description: data.description,
        hoursLogged: data.hoursLogged,
        workSummary: data.workSummary,
        taskReference: data.taskReference,
        contributionType: data.contributionType,
        contributionWeight,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        }
      }
    });

    // Update participation's lastActivityDate and handle stall recovery
    const wasInStall = participation && ['at_risk', 'diminishing', 'paused'].includes(participation.stallStage);
    
    await prisma.cycleParticipation.update({
      where: {
        userId_cycleId: {
          userId: req.user!.id,
          cycleId: data.cycleId
        }
      },
      data: {
        lastActivityDate: new Date(),
        stallStage: 'active',
        participationStatus: 'active'
      }
    });

    // If user was in stall, create recovery notification and potentially restore multiplier
    if (wasInStall) {
      // Create stall recovery notification
      await prisma.notification.create({
        data: {
          userId: req.user!.id,
          type: 'stall_recovery',
          message: 'Welcome back! Your participation status has been restored to active.',
          metadata: JSON.stringify({ 
            cycleId: data.cycleId, 
            previousStage: participation.stallStage,
            recoveredAt: new Date()
          }),
        }
      });

      // Check if multiplier needs to be restored to 1.0
      const currentMultiplier = await prisma.multiplier.findFirst({
        where: {
          userId: req.user!.id,
          cycleId: data.cycleId
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!currentMultiplier || currentMultiplier.multiplier < 1.0) {
        // Create new multiplier record for recovery
        await prisma.multiplier.create({
          data: {
            userId: req.user!.id,
            cycleId: data.cycleId,
            multiplier: 1.0,
            reason: `Stall recovery: restored from ${participation.stallStage} to active`
          }
        });

        // Create ledger entry for multiplier recovery
        await prisma.ownershipLedger.create({
          data: {
            userId: req.user!.id,
            cycleId: data.cycleId,
            eventType: 'multiplier_recovery',
            ownershipAmount: 0, // No ownership change, just multiplier
            multiplierSnapshot: 1.0,
            sourceReference: activity.id,
            createdBy: 'system'
          }
        });
      }

      console.log('🔄 Stall recovery triggered:', {
        userId: req.user!.id,
        cycleId: data.cycleId,
        previousStage: participation.stallStage,
        multiplierRestored: !currentMultiplier || currentMultiplier.multiplier < 1.0
      });
    }

    console.log('✅ Activity created successfully:', {
      activityId: activity.id,
      userId: req.user!.id,
      cycleId: data.cycleId,
      contributionWeight
    });

    res.status(201).json({
      success: true,
      data: activity,
      error: null
    });
  } catch (error) {
    console.error('❌ Error creating activity:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
      });
    }
    
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to create activity'
    });
  }
});

// Verify activity (admin only) - supports both POST and PATCH
router.patch('/:id/verify', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const verificationData = verifyActivitySchema.parse(req.body);

    // Get the activity to verify
    const existingActivity = await prisma.activityEvent.findUnique({
      where: { id: activityId },
      include: { user: true }
    });

    if (!existingActivity) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Activity not found'
      });
    }

    // Prevent self-verification
    if (existingActivity.userId === req.user!.id) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Cannot verify your own activities'
      });
    }

    // Calculate ownership if verified and not provided
    let calculatedOwnership = verificationData.calculatedOwnership || 0;
    if (verificationData.status === 'verified' && !verificationData.calculatedOwnership) {
      const baseReward = 0.1; // Base ownership reward
      const hoursLogged = existingActivity.hoursLogged || 1;
      const hoursFactor = Math.min(hoursLogged / 4, 2); // Cap at 2x for 4+ hours
      calculatedOwnership = baseReward * existingActivity.contributionWeight * hoursFactor;
    }

    // Update activity
    const activity = await prisma.activityEvent.update({
      where: { id: activityId },
      data: {
        status: verificationData.status,
        rejectionReason: verificationData.rejectionReason,
        feedbackComment: verificationData.feedbackComment,
        feedbackAuthor: verificationData.feedbackComment ? req.user!.id : null,
        feedbackTimestamp: verificationData.feedbackComment ? new Date() : null,
        calculatedOwnership,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        },
        verifier: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        feedbackGiver: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // If activity was verified, create ownership ledger entry and handle stall recovery
    if (verificationData.status === 'verified' && calculatedOwnership > 0) {
      await prisma.ownershipLedger.create({
        data: {
          userId: activity.userId,
          cycleId: activity.cycleId,
          eventType: 'contribution_approved',
          ownershipAmount: calculatedOwnership,
          multiplierSnapshot: 1.0, // Will be updated by multiplier system
          sourceReference: activity.id,
          createdBy: req.user!.id
        }
      });

      // Check if user was in stall and trigger recovery
      const participation = await prisma.cycleParticipation.findUnique({
        where: {
          userId_cycleId: {
            userId: activity.userId,
            cycleId: activity.cycleId
          }
        }
      });

      if (participation && ['at_risk', 'diminishing', 'paused'].includes(participation.stallStage)) {
        // Update participation status to active
        await prisma.cycleParticipation.update({
          where: {
            userId_cycleId: {
              userId: activity.userId,
              cycleId: activity.cycleId
            }
          },
          data: {
            stallStage: 'active',
            participationStatus: 'active',
            lastActivityDate: new Date()
          }
        });

        // Create recovery notification
        await prisma.notification.create({
          data: {
            userId: activity.userId,
            type: 'stall_recovery',
            message: 'Your verified activity has restored your participation status to active!',
            metadata: JSON.stringify({ 
              cycleId: activity.cycleId, 
              previousStage: participation.stallStage,
              activityId: activity.id,
              recoveredAt: new Date()
            }),
          }
        });

        // Restore multiplier to 1.0 if needed
        const currentMultiplier = await prisma.multiplier.findFirst({
          where: {
            userId: activity.userId,
            cycleId: activity.cycleId
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!currentMultiplier || currentMultiplier.multiplier < 1.0) {
          await prisma.multiplier.create({
            data: {
              userId: activity.userId,
              cycleId: activity.cycleId,
              multiplier: 1.0,
              reason: `Activity recovery: verified activity restored multiplier from ${participation.stallStage}`
            }
          });

          // Create ledger entry for multiplier recovery
          await prisma.ownershipLedger.create({
            data: {
              userId: activity.userId,
              cycleId: activity.cycleId,
              eventType: 'multiplier_recovery',
              ownershipAmount: 0,
              multiplierSnapshot: 1.0,
              sourceReference: activity.id,
              createdBy: req.user!.id
            }
          });
        }

        console.log('🔄 Stall recovery on verification:', {
          userId: activity.userId,
          cycleId: activity.cycleId,
          previousStage: participation.stallStage,
          activityId: activity.id
        });
      }
    }

    // Create audit trail
    await prisma.auditTrail.create({
      data: {
        adminId: req.user!.id,
        action: 'activity_verification',
        targetUserId: activity.userId,
        previousValue: JSON.stringify({ status: 'pending' }),
        newValue: JSON.stringify({ 
          status: verificationData.status,
          calculatedOwnership,
          rejectionReason: verificationData.rejectionReason 
        }),
        reason: `Activity ${verificationData.status}: ${activity.activityType}`,
      }
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: activity.userId,
        type: 'activity_verified',
        message: verificationData.status === 'verified' 
          ? `Your ${activity.contributionType} activity was verified and earned ${calculatedOwnership.toFixed(3)} ownership${verificationData.feedbackComment ? `. Admin feedback: ${verificationData.feedbackComment}` : ''}`
          : verificationData.status === 'rejected'
          ? `Your ${activity.contributionType} activity was rejected${verificationData.rejectionReason ? `: ${verificationData.rejectionReason}` : ''}${verificationData.feedbackComment ? `. Admin feedback: ${verificationData.feedbackComment}` : ''}`
          : `Changes requested for your ${activity.contributionType} activity${verificationData.rejectionReason ? `: ${verificationData.rejectionReason}` : ''}${verificationData.feedbackComment ? `. Admin feedback: ${verificationData.feedbackComment}` : ''}`,
        metadata: JSON.stringify({
          activityId: activity.id,
          status: verificationData.status,
          calculatedOwnership,
          feedbackComment: verificationData.feedbackComment,
        }),
      }
    });

    // Recalculate reputation and cycle engagement after verification
    ReputationService.calculateUserReputation(activity.userId).catch(err =>
      console.error('Failed to update reputation:', err)
    );
    ReputationService.updateCycleEngagement(activity.cycleId).catch(err =>
      console.error('Failed to update cycle engagement:', err)
    );

    res.json({
      success: true,
      data: activity,
      error: null
    });
  } catch (error) {
    console.error('❌ Error verifying activity:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `Validation error: ${error.errors.map(e => e.message).join(', ')}`
      });
    }
    
    res.status(500).json({
      success: false,
      data: null,
      error: 'Failed to verify activity'
    });
  }
});

// POST alias for verify (backward compatibility) - delegates to same logic as PATCH
router.post('/:id/verify', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const verificationData = verifyActivitySchema.parse(req.body);
    const existingActivity = await prisma.activityEvent.findUnique({ where: { id: activityId }, include: { user: true } });
    if (!existingActivity) return res.status(404).json({ success: false, data: null, error: 'Activity not found' });
    if (existingActivity.userId === req.user!.id) return res.status(403).json({ success: false, data: null, error: 'Cannot verify your own activities' });
    let calculatedOwnership = verificationData.calculatedOwnership || 0;
    if (verificationData.status === 'verified' && !verificationData.calculatedOwnership) {
      const hoursFactor = Math.min((existingActivity.hoursLogged || 1) / 4, 2);
      calculatedOwnership = 0.1 * existingActivity.contributionWeight * hoursFactor;
    }
    const activity = await prisma.activityEvent.update({
      where: { id: activityId },
      data: { status: verificationData.status, rejectionReason: verificationData.rejectionReason, feedbackComment: verificationData.feedbackComment, calculatedOwnership, verifiedBy: req.user!.id, verifiedAt: new Date() }
    });
    ReputationService.calculateUserReputation(existingActivity.userId).catch(() => {});
    res.json({ success: true, data: activity, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, data: null, error: error.errors.map(e => e.message).join(', ') });
    res.status(500).json({ success: false, data: null, error: 'Failed to verify activity' });
  }
});

// Dedicated approve route
router.post('/:id/approve', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  req.body = { ...req.body, status: 'verified' };
  const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const existingActivity = await prisma.activityEvent.findUnique({ where: { id: activityId } });
    if (!existingActivity) return res.status(404).json({ success: false, error: 'Activity not found' });
    const hoursLogged = existingActivity.hoursLogged || 1;
    const hoursFactor = Math.min(hoursLogged / 4, 2);
    const calculatedOwnership = 0.1 * existingActivity.contributionWeight * hoursFactor;
    await prisma.activityEvent.update({
      where: { id: activityId },
      data: { status: 'verified', calculatedOwnership, verifiedBy: req.user!.id, verifiedAt: new Date() }
    });
    ReputationService.calculateUserReputation(existingActivity.userId).catch(() => {});
    res.json({ success: true, data: { activityId, status: 'verified', calculatedOwnership }, error: null });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to approve activity' });
  }
});

// Dedicated reject route
router.post('/:id/reject', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const existingActivity = await prisma.activityEvent.findUnique({ where: { id: activityId } });
    if (!existingActivity) return res.status(404).json({ success: false, error: 'Activity not found' });
    await prisma.activityEvent.update({
      where: { id: activityId },
      data: { status: 'rejected', rejectionReason: req.body.reason, verifiedBy: req.user!.id, verifiedAt: new Date() }
    });
    res.json({ success: true, data: { activityId, status: 'rejected' }, error: null });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to reject activity' });
  }
});

// Dedicated request-changes route
router.post('/:id/request-changes', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const existingActivity = await prisma.activityEvent.findUnique({ where: { id: activityId } });
    if (!existingActivity) return res.status(404).json({ success: false, error: 'Activity not found' });
    await prisma.activityEvent.update({
      where: { id: activityId },
      data: { status: 'changes_requested', rejectionReason: req.body.reason, verifiedBy: req.user!.id, verifiedAt: new Date() }
    });
    res.json({ success: true, data: { activityId, status: 'changes_requested' }, error: null });
  } catch (_error) {
    res.status(500).json({ success: false, error: 'Failed to request changes' });
  }
});

// Update activity (admin only for verification)
router.patch('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updateData = verifyActivitySchema.parse(req.body);

    const activity = await prisma.activityEvent.update({
      where: { id: activityId },
      data: {
        status: updateData.status,
        rejectionReason: updateData.rejectionReason,
        calculatedOwnership: updateData.calculatedOwnership || 0,
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        cycle: {
          select: {
            id: true,
            name: true,
            state: true
          }
        },
        verifier: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    // If activity was verified, create ownership ledger entry
    if (updateData.status === 'verified' && updateData.calculatedOwnership) {
      await prisma.ownershipLedger.create({
        data: {
          userId: activity.userId,
          cycleId: activity.cycleId,
          eventType: 'contribution_approved',
          ownershipAmount: updateData.calculatedOwnership,
          multiplierSnapshot: 1.0, // Will be updated by multiplier system
          sourceReference: activity.id,
          createdBy: req.user!.id
        }
      });
    }

    res.json({
      success: true,
      data: activity,
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        data: null,
        error: error.issues.map(i => i.message).join(', ')
      });
    }
    res.status(500).json({ 
      success: false,
      data: null,
      error: 'Internal server error' 
    });
  }
});

// Delete activity (admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin', 'founder']), async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    await prisma.activityEvent.delete({
      where: { id: activityId }
    });

    res.json({ message: 'Activity deleted successfully' });
  } catch (_error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create dispute for activity
router.post('/:id/dispute', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const schema = z.object({
      reason: z.string().min(10, 'Reason must be at least 10 characters')
    });

    const { reason } = schema.parse(req.body);

    // Check if activity exists and belongs to user
    const activity = await prisma.activityEvent.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        error: 'Activity not found'
      });
    }

    if (activity.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Can only dispute your own activities'
      });
    }

    // Check if dispute already exists
    const existingDispute = await prisma.dispute.findFirst({
      where: { activityId, userId: req.user!.id }
    });

    if (existingDispute) {
      return res.status(400).json({
        success: false,
        error: 'Dispute already exists for this activity'
      });
    }

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        userId: req.user!.id,
        activityId,
        reason,
        status: 'pending'
      },
      include: {
        activity: {
          select: {
            id: true,
            activityType: true,
            description: true,
            status: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: dispute,
      error: null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors.map(e => e.message).join(', ')
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create dispute'
    });
  }
});

export default router;