import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, requireFullAccess, AuthRequest } from '../middleware/auth';
import { ReputationService } from '../services/reputationService';
import { requireAgreement } from '../middleware/requireAgreement';
import { validateActivitySubmission } from '../services/activityValidationService';
import { isActiveParticipant, completeTaskViaActivity, getEffectiveContributionWeight, auditLog } from '../services/integrityService';
import { getFoundationPhaseEnabled } from './config';

const router = Router();

// All activity routes require an accepted agreement
router.use(requireAgreement);

const createActivitySchema = z.object({
  cycleId: z.string(),
  activityType: z.string(),
  proofLink: z.string().url(),
  description: z.string().optional(),
  hoursLogged: z.number().min(0.1).max(12).optional(),
  workSummary: z.string().optional(),
  taskReference: z.string().optional(),
  linkedTaskId: z.string().optional(),
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
  SUBMISSION_COOLDOWN_SECONDS: 60, // minimum gap between submissions per user
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

    const where: { cycleId?: string; userId?: string; linkedTaskId?: string } = {};
    
    if (cycleId) where.cycleId = cycleId as string;
    if (userId) where.userId = userId as string;
    if (req.query.linkedTaskId) where.linkedTaskId = req.query.linkedTaskId as string;
    
    // If no specific user requested, show only current user's activities
    if (!userId && !req.query.linkedTaskId) where.userId = req.user!.id;

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
router.post('/', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
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
        error: limitsCheck.error,
      });
    }

    // Per-user submission cooldown (backend-enforced)
    const lastSubmission = await prisma.activityEvent.findFirst({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (lastSubmission) {
      const secondsSinceLast = (Date.now() - lastSubmission.createdAt.getTime()) / 1000;
      if (secondsSinceLast < ACTIVITY_LIMITS.SUBMISSION_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(ACTIVITY_LIMITS.SUBMISSION_COOLDOWN_SECONDS - secondsSinceLast);
        return res.status(429).json({
          success: false,
          data: null,
          error: `Please wait ${remaining} seconds before submitting another activity.`,
        });
      }
    }

    // Proof URL, duplicate, and quality validation
    const validation = await validateActivitySubmission({
      userId: req.user!.id,
      cycleId: data.cycleId,
      contributionType: data.contributionType,
      proofLink: data.proofLink,
      description: data.description,
      workSummary: data.workSummary,
      hoursLogged: data.hoursLogged,
    });
    if (!validation.valid) {
      return res.status(422).json({
        success: false,
        data: null,
        error: 'Activity validation failed',
        details: validation.errors,
        warnings: validation.warnings,
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

    // ISSUE 5: validate active participation (checks optedIn + not on leave + not closed)
    const active = await isActiveParticipant(req.user!.id, data.cycleId);
    if (!active) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Must be an active participant in this cycle to submit activities',
      });
    }

    // Check if user is on leave (redundant safety check — isActiveParticipant covers this,
    // but kept for the specific error message)
    const now = new Date();
    const activeLeave = await prisma.participationLeave.findFirst({
      where: {
        userId: req.user!.id,
        cycleId: data.cycleId,
        status: 'paused',
        leaveStart: { lte: now },
        OR: [{ leaveEnd: null }, { leaveEnd: { gte: now } }],
      },
    });
    if (activeLeave) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Cannot submit activities while on leave',
      });
    }

    // Task link validation
    if (data.linkedTaskId) {
      const isAdmin = ['admin', 'founder'].includes(req.user!.role);
      const linkedTask = await prisma.task.findUnique({
        where: { id: data.linkedTaskId },
        include: { assignments: { where: { userId: req.user!.id } } },
      });

      if (!linkedTask) {
        return res.status(404).json({ success: false, data: null, error: 'Task not found' });
      }
      if (linkedTask.cycleId !== data.cycleId) {
        return res.status(400).json({ success: false, data: null, error: 'Task does not belong to the selected cycle' });
      }
      if (!isAdmin && linkedTask.assignments.length === 0) {
        return res.status(403).json({ success: false, data: null, error: 'You are not assigned to this task' });
      }
      if (linkedTask.status === 'completed') {
        return res.status(400).json({ success: false, data: null, error: 'Task is already completed' });
      }
    }

    // Get contribution weight from database
    let contributionWeight = data.contributionWeight || 1.0;
    const weightConfig = await prisma.contributionWeight.findUnique({
      where: { contributionType: data.contributionType }
    });
    if (weightConfig) {
      contributionWeight = weightConfig.weight;
    }

    // ISSUE 7: apply reduced weight if this activity is linked to a starter task
    contributionWeight = await getEffectiveContributionWeight(contributionWeight, data.linkedTaskId);

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
        linkedTaskId: data.linkedTaskId,
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

    // Do NOT touch lastActivityDate or stallStage on submission.
    // The stall clock resets only on verified activity (handled in the verify route).
    // Resetting on submission would let users game the countdown by spamming pending activities.

    // NOTE: stall recovery (lastActivityDate reset, multiplier restore, notification)
    // is intentionally handled only in the verify route, not here.
    // This prevents users from gaming the stall countdown by submitting unverified activities.

    // ── Foundation Phase auto-approve (founder only) ──────────────────────────
    // When foundation phase is enabled AND the submitter is a founder, the activity
    // is immediately auto-approved. The manual approval system is NOT removed —
    // this is purely an additive conditional bypass.
    if (req.user!.role === 'founder') {
      const foundationPhaseEnabled = await getFoundationPhaseEnabled();
      if (foundationPhaseEnabled) {
        const baseReward = 0.1;
        const hoursLogged = activity.hoursLogged || 1;
        const hoursFactor = Math.min(hoursLogged / 4, 2);
        const autoOwnership = baseReward * activity.contributionWeight * hoursFactor;

        await prisma.$transaction(async (tx) => {
          await tx.activityEvent.update({
            where: { id: activity.id },
            data: {
              status: 'verified',
              calculatedOwnership: autoOwnership,
              verifiedBy: req.user!.id,
              verifiedAt: new Date(),
              feedbackComment: 'Auto-approved: Foundation Phase',
              feedbackAuthor: req.user!.id,
              feedbackTimestamp: new Date(),
            },
          });

          const latestMultiplier = await tx.multiplier.findFirst({
            where: { userId: req.user!.id, cycleId: activity.cycleId },
            orderBy: { createdAt: 'desc' },
          });
          const multiplierSnapshot = latestMultiplier?.multiplier ?? 1.0;

          await tx.ownershipLedger.create({
            data: {
              userId: req.user!.id,
              cycleId: activity.cycleId,
              eventType: 'contribution_approved',
              ownershipAmount: autoOwnership,
              multiplierSnapshot,
              sourceReference: activity.id,
              createdBy: req.user!.id,
            },
          });

          await tx.auditTrail.create({
            data: {
              adminId: req.user!.id,
              action: 'activity_verification',
              targetUserId: req.user!.id,
              previousValue: JSON.stringify({ status: 'pending' }),
              newValue: JSON.stringify({ status: 'verified', calculatedOwnership: autoOwnership, foundationPhase: true }),
              reason: 'Foundation Phase auto-approval',
            },
          });
        });
      }
    }
    // ── End foundation phase block ────────────────────────────────────────────

    console.log('✅ Activity created successfully:', {
      activityId: activity.id,
      userId: req.user!.id,
      cycleId: data.cycleId,
      contributionWeight
    });

    res.status(201).json({
      success: true,
      data: activity,
      warnings: validation.warnings.length > 0 ? validation.warnings : undefined,
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

    // Prevent double-verification
    if (existingActivity.status !== 'pending') {
      return res.status(409).json({
        success: false,
        data: null,
        error: `Activity has already been ${existingActivity.status}. Use PATCH /:id/verify only on pending activities.`,
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

    // ── Atomic transaction ────────────────────────────────────────────────────
    const activity = await prisma.$transaction(async (tx) => {
      // Update activity status
      const updated = await tx.activityEvent.update({
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
          user: { select: { id: true, email: true, name: true } },
          cycle: { select: { id: true, name: true, state: true } },
          verifier: { select: { id: true, email: true, name: true } },
          feedbackGiver: { select: { id: true, name: true, email: true } },
        },
      });

      if (verificationData.status === 'verified' && calculatedOwnership > 0) {
        // Get current multiplier inside transaction
        const latestMultiplier = await tx.multiplier.findFirst({
          where: { userId: updated.userId, cycleId: updated.cycleId },
          orderBy: { createdAt: 'desc' },
        });
        const multiplierSnapshot = latestMultiplier?.multiplier ?? 1.0;

        // Write ownership ledger entry
        await tx.ownershipLedger.create({
          data: {
            userId: updated.userId,
            cycleId: updated.cycleId,
            eventType: 'contribution_approved',
            ownershipAmount: calculatedOwnership,
            multiplierSnapshot,
            sourceReference: updated.id,
            createdBy: req.user!.id,
          },
        });

        // ISSUE 2: if activity is linked to a task, mark that task assignment approved
        await completeTaskViaActivity(tx, updated.id, updated.userId);

        // Stall recovery
        const participation = await tx.cycleParticipation.findUnique({
          where: { userId_cycleId: { userId: updated.userId, cycleId: updated.cycleId } },
        });

        if (participation) {
          const wasInStall = ['at_risk', 'diminishing', 'paused'].includes(participation.stallStage);

          await tx.cycleParticipation.update({
            where: { userId_cycleId: { userId: updated.userId, cycleId: updated.cycleId } },
            data: {
              lastActivityDate: new Date(),
              ...(wasInStall && { stallStage: 'active', participationStatus: 'active' }),
            },
          });

          if (wasInStall) {
            await tx.notification.create({
              data: {
                userId: updated.userId,
                type: 'stall_recovery',
                message: 'Your verified activity has restored your participation status to active!',
                metadata: JSON.stringify({
                  cycleId: updated.cycleId,
                  previousStage: participation.stallStage,
                  activityId: updated.id,
                  recoveredAt: new Date(),
                }),
              },
            });

            if (!latestMultiplier || latestMultiplier.multiplier < 1.0) {
              await tx.multiplier.create({
                data: {
                  userId: updated.userId,
                  cycleId: updated.cycleId,
                  multiplier: 1.0,
                  reason: `Stall recovery: verified activity restored multiplier from ${participation.stallStage}`,
                },
              });
              await tx.ownershipLedger.create({
                data: {
                  userId: updated.userId,
                  cycleId: updated.cycleId,
                  eventType: 'multiplier_recovery',
                  ownershipAmount: 0,
                  multiplierSnapshot: 1.0,
                  sourceReference: updated.id,
                  createdBy: req.user!.id,
                },
              });
            }
          }
        }
      }

      // Audit trail (existing AuditTrail model)
      await tx.auditTrail.create({
        data: {
          adminId: req.user!.id,
          action: 'activity_verification',
          targetUserId: updated.userId,
          previousValue: JSON.stringify({ status: 'pending' }),
          newValue: JSON.stringify({
            status: verificationData.status,
            calculatedOwnership,
            rejectionReason: verificationData.rejectionReason,
          }),
          reason: `Activity ${verificationData.status}: ${updated.activityType}`,
        },
      });

      // ISSUE 10: structured admin action log for activity verification
      await tx.adminActionLog.create({
        data: {
          adminId: req.user!.id,
          action: `activity_${verificationData.status}`,
          entityType: 'activity',
          entityId: updated.id,
          targetUserIds: JSON.stringify([updated.userId]),
          metadata: JSON.stringify({
            cycleId: updated.cycleId,
            activityType: updated.activityType,
            calculatedOwnership,
            linkedTaskId: updated.linkedTaskId,
          }),
        },
      });

      // Notification
      await tx.notification.create({
        data: {
          userId: updated.userId,
          type: 'activity_verified',
          message:
            verificationData.status === 'verified'
              ? `Your ${updated.contributionType} activity was verified and earned ${calculatedOwnership.toFixed(3)} ownership${verificationData.feedbackComment ? `. Admin feedback: ${verificationData.feedbackComment}` : ''}`
              : verificationData.status === 'rejected'
              ? `Your ${updated.contributionType} activity was rejected${verificationData.rejectionReason ? `: ${verificationData.rejectionReason}` : ''}${verificationData.feedbackComment ? `. Admin feedback: ${verificationData.feedbackComment}` : ''}`
              : `Changes requested for your ${updated.contributionType} activity${verificationData.rejectionReason ? `: ${verificationData.rejectionReason}` : ''}${verificationData.feedbackComment ? `. Admin feedback: ${verificationData.feedbackComment}` : ''}`,
          metadata: JSON.stringify({
            activityId: updated.id,
            status: verificationData.status,
            calculatedOwnership,
            feedbackComment: verificationData.feedbackComment,
          }),
        },
      });

      return updated;
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

// POST alias for verify — REMOVED (use PATCH /:id/verify)
// Dedicated approve route — REMOVED (use PATCH /:id/verify with status: 'verified')
// Dedicated reject route — REMOVED (use PATCH /:id/verify with status: 'rejected')

// Generic PATCH /:id — REMOVED. Use PATCH /:id/verify for all verification actions.

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
router.post('/:id/dispute', authMiddleware, requireFullAccess, async (req: AuthRequest, res: Response) => {
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