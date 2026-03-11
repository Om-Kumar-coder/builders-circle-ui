"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createCycleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    startDate: zod_1.z.string().datetime(),
    endDate: zod_1.z.string().datetime(),
});
const updateCycleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    state: zod_1.z.enum(['planned', 'active', 'paused', 'closed']).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
});
// Get all cycles
router.get('/', auth_1.authMiddleware, async (_req, res) => {
    try {
        const cycles = await database_1.prisma.buildCycle.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { participations: true }
                }
            }
        });
        const cyclesWithCount = cycles.map((cycle) => ({
            ...cycle,
            participantCount: cycle._count.participations
        }));
        res.json(cyclesWithCount);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single cycle
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const cycle = await database_1.prisma.buildCycle.findUnique({
            where: { id: cycleId },
            include: {
                _count: {
                    select: { participations: true }
                }
            }
        });
        if (!cycle) {
            return res.status(404).json({ error: 'Cycle not found' });
        }
        res.json({
            ...cycle,
            participantCount: cycle._count.participations
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create cycle (admin only)
router.post('/', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const { name, startDate, endDate } = createCycleSchema.parse(req.body);
        const cycle = await database_1.prisma.buildCycle.create({
            data: {
                name,
                state: 'planned',
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            }
        });
        res.status(201).json(cycle);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update cycle (admin only)
router.patch('/:id', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const updateData = updateCycleSchema.parse(req.body);
        const cycle = await database_1.prisma.buildCycle.update({
            where: { id: cycleId },
            data: {
                ...updateData,
                startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
                endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
            }
        });
        res.json(cycle);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete cycle (admin only)
router.delete('/:id', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const cycleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        await database_1.prisma.buildCycle.delete({
            where: { id: cycleId }
        });
        res.json({ message: 'Cycle deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=cycles.js.map