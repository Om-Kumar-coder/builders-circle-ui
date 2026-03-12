"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const createCycleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Cycle name is required"),
    description: zod_1.z.string().optional(),
    startDate: zod_1.z.string().refine((date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }, "Invalid start date format"),
    endDate: zod_1.z.string().refine((date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }, "Invalid end date format"),
}).refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
}, {
    message: "End date must be after start date",
    path: ["endDate"]
});
const updateCycleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    state: zod_1.z.enum(['planned', 'active', 'paused', 'closed']).optional(),
    startDate: zod_1.z.string().refine((date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }, "Invalid start date format").optional(),
    endDate: zod_1.z.string().refine((date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
    }, "Invalid end date format").optional(),
});
// Get all cycles
router.get('/', auth_1.authMiddleware, async (_req, res) => {
    try {
        console.log('📋 Fetching all cycles');
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
        console.log('✅ Cycles fetched:', { count: cyclesWithCount.length });
        res.json({
            success: true,
            data: cyclesWithCount,
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error fetching cycles:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: 'Failed to fetch cycles'
        });
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
        console.log('🚀 Creating cycle:', {
            userId: req.user?.id,
            body: req.body
        });
        const validatedData = createCycleSchema.parse(req.body);
        const { name, description, startDate, endDate } = validatedData;
        // Parse dates (validation already done by schema)
        const start = new Date(startDate);
        const end = new Date(endDate);
        console.log('📅 Parsed dates:', {
            startDate,
            endDate,
            startParsed: start.toISOString(),
            endParsed: end.toISOString()
        });
        // Check for duplicate names
        const existingCycle = await database_1.prisma.buildCycle.findFirst({
            where: { name }
        });
        if (existingCycle) {
            console.log('❌ Cycle name already exists:', name);
            return res.status(400).json({
                success: false,
                data: null,
                error: 'Cycle name already exists'
            });
        }
        const cycle = await database_1.prisma.buildCycle.create({
            data: {
                name,
                description: description || null,
                state: 'planned',
                startDate: start,
                endDate: end,
            }
        });
        console.log('✅ Cycle created successfully:', {
            cycleId: cycle.id,
            name: cycle.name
        });
        res.status(201).json({
            success: true,
            data: cycle,
            error: null
        });
    }
    catch (error) {
        console.error('❌ Error creating cycle:', error);
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
            error: 'Failed to create cycle'
        });
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