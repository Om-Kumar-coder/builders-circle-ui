"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get audit logs (admin only)
router.get('/audit', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (_req, res) => {
    try {
        const auditLogs = await database_1.prisma.auditTrail.findMany({
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
        res.json(auditLogs);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Resolve dispute (admin only)
router.post('/resolve-dispute', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const schema = zod_1.z.object({
            disputeId: zod_1.z.string(),
            status: zod_1.z.enum(['approved', 'denied']),
            resolution: zod_1.z.string()
        });
        const { disputeId, status, resolution } = schema.parse(req.body);
        // Update dispute
        const dispute = await database_1.prisma.dispute.update({
            where: { id: disputeId },
            data: {
                status,
                resolution,
                resolvedAt: new Date(),
                resolvedBy: req.user.id
            }
        });
        // Create audit trail
        await database_1.prisma.auditTrail.create({
            data: {
                adminId: req.user.id,
                action: 'dispute_resolution',
                targetUserId: dispute.userId,
                previousValue: JSON.stringify({ status: 'pending' }),
                newValue: JSON.stringify({ status, resolution }),
                reason: `Dispute resolved: ${resolution}`,
                timestamp: new Date()
            }
        });
        res.json({ message: 'Dispute resolved successfully', dispute });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get admin stats (admin only)
router.get('/stats', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (_req, res) => {
    try {
        const [userCount, cycleCount, activityCount, participationCount] = await Promise.all([
            database_1.prisma.user.count(),
            database_1.prisma.buildCycle.count(),
            database_1.prisma.activityEvent.count(),
            database_1.prisma.cycleParticipation.count({ where: { optedIn: true } })
        ]);
        res.json({
            userCount,
            cycleCount,
            activityCount,
            participationCount
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all users (admin only)
router.get('/users', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (_req, res) => {
    try {
        const users = await database_1.prisma.user.findMany({
            include: {
                profile: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update user role (admin only)
router.patch('/users/:id/role', auth_1.authMiddleware, (0, auth_1.roleMiddleware)(['admin', 'founder']), async (req, res) => {
    try {
        const schema = zod_1.z.object({
            role: zod_1.z.enum(['founder', 'admin', 'contributor', 'employee', 'observer'])
        });
        const { role } = schema.parse(req.body);
        const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const profile = await database_1.prisma.userProfile.update({
            where: { userId },
            data: { role }
        });
        // Create audit trail
        await database_1.prisma.auditTrail.create({
            data: {
                adminId: req.user.id,
                action: 'role_change',
                targetUserId: userId,
                previousValue: JSON.stringify({ role: 'previous_role' }),
                newValue: JSON.stringify({ role }),
                reason: `Role changed to ${role}`,
                timestamp: new Date()
            }
        });
        res.json({ message: 'User role updated successfully', profile });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.issues });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map