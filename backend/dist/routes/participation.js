"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const joinCycleSchema = zod_1.z.object({
    cycleId: zod_1.z.string(),
});
// Join a cycle
router.post('/join', auth_1.authMiddleware, async (req, res) => {
    try {
        const { cycleId } = joinCycleSchema.parse(req.body);
        // Check if cycle exists and is active
        const cycle = await database_1.prisma.buildCycle.findUnique({
            where: { id: cycleId }
        });
        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }
        if (cycle.state !== 'active') {
            return res.status(400).json({ error: 'Cycle is not active' });
        }
        // Check if already participating
        const existingParticipation = await database_1.prisma.cycleParticipation.findUnique({
            where: {
                userId_cycleId: {
                    userId: req.user.id,
                    cycleId
                }
            }
        });
        if (existingParticipation) {
            return res.status(400).json({ error: 'Already participating in this cycle' });
        }
        // Create participation
        const participation = await database_1.prisma.cycleParticipation.create({
            data: {
                userId: req.user.id,
                cycleId,
                optedIn: true,
                participationStatus: 'grace',
                stallStage: 'grace'
            }
        });
        res.status(201).json(participation);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get participation for a cycle
router.get('/:cycleId', auth_1.authMiddleware, async (req, res) => {
    try {
        const participation = await database_1.prisma.cycleParticipation.findUnique({
            where: {
                userId_cycleId: {
                    userId: req.user.id,
                    cycleId: Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId
                }
            },
            include: {
                cycle: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });
        if (!participation) {
            return res.status(404).json({ error: 'Participation not found' });
        }
        res.json(participation);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update participation
router.patch('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const updateData = zod_1.z.object({
            optedIn: zod_1.z.boolean().optional(),
        }).parse(req.body);
        const participationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const participation = await database_1.prisma.cycleParticipation.update({
            where: {
                id: participationId,
                userId: req.user.id // Ensure user can only update their own participation
            },
            data: updateData
        });
        res.json(participation);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all participants in a cycle (admin only)
router.get('/:cycleId/all', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const cycleId = Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId;
        const participants = await database_1.prisma.cycleParticipation.findMany({
            where: { cycleId },
            include: {
                user: {
                    include: {
                        profile: true,
                        activityEvents: {
                            where: { cycleId },
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // Calculate stall stages based on last activity
        const now = new Date();
        const participantsWithStallStage = participants.map(participation => {
            const lastActivity = participation.user.activityEvents[0];
            let calculatedStallStage = 'paused';
            if (lastActivity) {
                const daysSinceLastActivity = Math.floor((now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceLastActivity <= 6) {
                    calculatedStallStage = 'active';
                }
                else if (daysSinceLastActivity <= 13) {
                    calculatedStallStage = 'at_risk';
                }
                else if (daysSinceLastActivity <= 20) {
                    calculatedStallStage = 'diminishing';
                }
                else {
                    calculatedStallStage = 'paused';
                }
            }
            return {
                ...participation,
                calculatedStallStage,
                lastActivityDate: lastActivity?.createdAt || null
            };
        });
        res.json(participantsWithStallStage);
    }
    catch (error) {
        console.error('Participants error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=participation.js.map