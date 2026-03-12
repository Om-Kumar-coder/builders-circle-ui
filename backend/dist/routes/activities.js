"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createActivitySchema = zod_1.z.object({
    cycleId: zod_1.z.string(),
    activityType: zod_1.z.string(),
    proofLink: zod_1.z.string().url(),
    description: zod_1.z.string().optional(),
    hoursLogged: zod_1.z.number().min(0.1).max(12).optional(),
    workSummary: zod_1.z.string().optional(),
    taskReference: zod_1.z.string().optional(),
    contributionType: zod_1.z.enum(['code', 'documentation', 'review', 'hours_logged', 'meeting', 'research', 'task_completion']).default('code'),
    contributionWeight: zod_1.z.number().min(0).max(10).default(1.0),
});
const verifyActivitySchema = zod_1.z.object({
    status: zod_1.z.enum(['verified', 'rejected', 'changes_requested']),
    rejectionReason: zod_1.z.string().optional(),
    calculatedOwnership: zod_1.z.number().optional(),
});
// Anti-abuse limits
const ACTIVITY_LIMITS = {
    MAX_ACTIVITIES_PER_DAY: 10,
    MAX_HOURS_PER_DAY: 12,
};
// Check daily limits
async function checkDailyLimits(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayActivities = await database_1.prisma.activityEvent.findMany({
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
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        console.log('📋 Fetching activities:', {
            userId: req.user?.id,
            query: req.query
        });
        const { cycleId, userId } = req.query;
        const where = {};
        if (cycleId)
            where.cycleId = cycleId;
        if (userId)
            where.userId = userId;
        // If no specific user requested, show only current user's activities
        if (!userId)
            where.userId = req.user.id;
        const activities = await database_1.prisma.activityEvent.findMany({
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
    }
    catch (error) {
        console.error('❌ Error fetching activities:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to fetch activities'
        });
    }
});
// Get pending activities for admin review
router.get('/pending', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const activities = await database_1.prisma.activityEvent.findMany({
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
    }
    catch (error) {
        console.error('❌ Error fetching pending activities:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to fetch pending activities'
        });
    }
});
// Create activity
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        console.log('🚀 Creating activity:', {
            userId: req.user?.id,
            body: req.body
        });
        const data = createActivitySchema.parse(req.body);
        // Check daily limits
        const limitsCheck = await checkDailyLimits(req.user.id);
        if (!limitsCheck.canSubmit) {
            return res.status(429).json({
                success: false,
                data: null,
                error: limitsCheck.error
            });
        }
        // Check if cycle exists and is active
        const cycle = await database_1.prisma.buildCycle.findUnique({
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
        const participation = await database_1.prisma.cycleParticipation.findUnique({
            where: {
                userId_cycleId: {
                    userId: req.user.id,
                    cycleId: data.cycleId
                }
            }
        });
        if (!participation || !participation.optedIn) {
            console.log('❌ User not participating:', { userId: req.user.id, cycleId: data.cycleId });
            return res.status(400).json({
                success: false,
                data: null,
                error: 'Must be participating in cycle to submit activities'
            });
        }
        // Create activity
        const activity = await database_1.prisma.activityEvent.create({
            data: {
                userId: req.user.id,
                cycleId: data.cycleId,
                activityType: data.activityType,
                proofLink: data.proofLink,
                description: data.description,
                hoursLogged: data.hoursLogged,
                workSummary: data.workSummary,
                taskReference: data.taskReference,
                contributionType: data.contributionType,
                contributionWeight: data.contributionWeight,
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
        // Update participation's lastActivityDate and reset stall stage
        await database_1.prisma.cycleParticipation.update({
            where: {
                userId_cycleId: {
                    userId: req.user.id,
                    cycleId: data.cycleId
                }
            },
            data: {
                lastActivityDate: new Date(),
                stallStage: 'active',
                participationStatus: 'active'
            }
        });
        console.log('✅ Activity created successfully:', {
            activityId: activity.id,
            userId: req.user.id,
            cycleId: data.cycleId
        });
        res.status(201).json({
            success: true,
            data: activity,
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error creating activity:', error);
        if (error instanceof zod_1.z.ZodError) {
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
// Verify activity (admin only)
router.patch('/:id/verify', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const verificationData = verifyActivitySchema.parse(req.body);
        // Get the activity to verify
        const existingActivity = await database_1.prisma.activityEvent.findUnique({
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
        if (existingActivity.userId === req.user.id) {
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
        const activity = await database_1.prisma.activityEvent.update({
            where: { id: activityId },
            data: {
                status: verificationData.status,
                rejectionReason: verificationData.rejectionReason,
                calculatedOwnership,
                verifiedBy: req.user.id,
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
        if (verificationData.status === 'verified' && calculatedOwnership > 0) {
            await database_1.prisma.ownershipLedger.create({
                data: {
                    userId: activity.userId,
                    cycleId: activity.cycleId,
                    eventType: 'contribution_approved',
                    ownershipAmount: calculatedOwnership,
                    multiplierSnapshot: 1.0, // Will be updated by multiplier system
                    sourceReference: activity.id,
                    createdBy: req.user.id
                }
            });
        }
        // Create audit trail
        await database_1.prisma.auditTrail.create({
            data: {
                adminId: req.user.id,
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
        await database_1.prisma.notification.create({
            data: {
                userId: activity.userId,
                type: 'activity_verified',
                message: verificationData.status === 'verified'
                    ? `Your ${activity.contributionType} activity was verified and earned ${calculatedOwnership.toFixed(3)} ownership`
                    : verificationData.status === 'rejected'
                        ? `Your ${activity.contributionType} activity was rejected: ${verificationData.rejectionReason || 'No reason provided'}`
                        : `Changes requested for your ${activity.contributionType} activity: ${verificationData.rejectionReason || 'Please review and resubmit'}`,
                metadata: JSON.stringify({
                    activityId: activity.id,
                    status: verificationData.status,
                    calculatedOwnership,
                }),
            }
        });
        res.json({
            success: true,
            data: activity,
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error verifying activity:', error);
        if (error instanceof zod_1.z.ZodError) {
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
// Update activity (admin only for verification)
router.patch('/:id', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const updateData = verifyActivitySchema.parse(req.body);
        const activity = await database_1.prisma.activityEvent.update({
            where: { id: activityId },
            data: {
                status: updateData.status,
                rejectionReason: updateData.rejectionReason,
                calculatedOwnership: updateData.calculatedOwnership || 0,
                verifiedBy: req.user.id,
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
            await database_1.prisma.ownershipLedger.create({
                data: {
                    userId: activity.userId,
                    cycleId: activity.cycleId,
                    eventType: 'contribution_approved',
                    ownershipAmount: updateData.calculatedOwnership,
                    multiplierSnapshot: 1.0, // Will be updated by multiplier system
                    sourceReference: activity.id,
                    createdBy: req.user.id
                }
            });
        }
        res.json({
            success: true,
            data: activity,
            error: null
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
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
router.delete('/:id', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await database_1.prisma.activityEvent.delete({
            where: { id: activityId }
        });
        res.json({ message: 'Activity deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=activities.js.map