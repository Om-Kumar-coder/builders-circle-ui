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
    contributionType: zod_1.z.enum(['code', 'documentation', 'review', 'hours_logged']).default('code'),
    contributionWeight: zod_1.z.number().min(0).max(10).default(1.0),
});
const updateActivitySchema = zod_1.z.object({
    verified: zod_1.z.enum(['pending', 'verified', 'rejected']).optional(),
    calculatedOwnership: zod_1.z.number().optional(),
});
// Get activities
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
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
                }
            }
        });
        res.json(activities);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create activity
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = createActivitySchema.parse(req.body);
        // Check if cycle exists and is active
        const cycle = await database_1.prisma.buildCycle.findUnique({
            where: { id: data.cycleId }
        });
        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }
        if (cycle.state !== 'active') {
            return res.status(400).json({ error: 'Cycle is not active' });
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
            return res.status(400).json({ error: 'Must be participating in cycle to submit activities' });
        }
        // Create activity
        const activity = await database_1.prisma.activityEvent.create({
            data: {
                userId: req.user.id,
                cycleId: data.cycleId,
                activityType: data.activityType,
                proofLink: data.proofLink,
                description: data.description,
                contributionType: data.contributionType,
                contributionWeight: data.contributionWeight,
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
        res.status(201).json(activity);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update activity (admin only for verification)
router.patch('/:id', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const activityId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const updateData = updateActivitySchema.parse(req.body);
        const activity = await database_1.prisma.activityEvent.update({
            where: { id: activityId },
            data: updateData,
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
        // If activity was verified, create ownership ledger entry
        if (updateData.verified === 'verified' && updateData.calculatedOwnership) {
            await database_1.prisma.ownershipLedger.create({
                data: {
                    userId: activity.userId,
                    cycleId: activity.cycleId,
                    eventType: 'activity_verified',
                    ownershipAmount: updateData.calculatedOwnership,
                    multiplierSnapshot: 1.0, // Will be updated by multiplier system
                    sourceReference: activity.id,
                    createdBy: req.user.id
                }
            });
        }
        res.json(activity);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
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