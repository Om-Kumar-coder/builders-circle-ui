"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get ownership data for user in a cycle
router.get('/:userId/:cycleId', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const cycleId = Array.isArray(req.params.cycleId) ? req.params.cycleId[0] : req.params.cycleId;
        // Users can only view their own ownership unless they're admin
        if (userId !== req.user.id && !['admin', 'founder'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Get all ownership ledger entries
        const ledgerEntries = await database_1.prisma.ownershipLedger.findMany({
            where: {
                userId,
                cycleId
            },
            orderBy: { createdAt: 'desc' }
        });
        // Calculate total ownership
        const totalOwnership = ledgerEntries.reduce((sum, entry) => sum + entry.ownershipAmount, 0);
        // Get latest multiplier
        const latestMultiplier = await database_1.prisma.multiplier.findFirst({
            where: {
                userId,
                cycleId
            },
            orderBy: { createdAt: 'desc' }
        });
        const multiplier = latestMultiplier?.multiplier || 1.0;
        const effectiveOwnership = totalOwnership * multiplier;
        // Calculate vested vs provisional ownership
        // Business logic: Ownership becomes vested based on time and activity
        // For now, we'll use a simple time-based vesting schedule
        const cycle = await database_1.prisma.buildCycle.findUnique({
            where: { id: cycleId }
        });
        let vestedPercentage = 0;
        if (cycle) {
            const now = new Date();
            const cycleStart = new Date(cycle.startDate);
            const cycleEnd = new Date(cycle.endDate);
            const cycleDuration = cycleEnd.getTime() - cycleStart.getTime();
            const elapsed = Math.max(0, now.getTime() - cycleStart.getTime());
            // Vesting schedule: 0% at start, 100% at end, linear progression
            vestedPercentage = Math.min(1, elapsed / cycleDuration);
        }
        const vestedOwnership = totalOwnership * vestedPercentage;
        const provisionalOwnership = totalOwnership - vestedOwnership;
        res.json({
            success: true,
            totalOwnership,
            vestedOwnership,
            provisionalOwnership,
            multiplier,
            effectiveOwnership,
            vestedPercentage: Math.round(vestedPercentage * 100),
            entriesCount: ledgerEntries.length,
            entries: ledgerEntries
        });
    }
    catch (error) {
        console.error('Ownership error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get ownership summary for all cycles (current user)
router.get('/summary', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        // Get all cycles user has participated in
        const participations = await database_1.prisma.cycleParticipation.findMany({
            where: { userId },
            include: {
                cycle: true
            }
        });
        const ownershipSummary = await Promise.all(participations.map(async (participation) => {
            const ledgerEntries = await database_1.prisma.ownershipLedger.findMany({
                where: {
                    userId,
                    cycleId: participation.cycleId
                }
            });
            const totalOwnership = ledgerEntries.reduce((sum, entry) => sum + entry.ownershipAmount, 0);
            const latestMultiplier = await database_1.prisma.multiplier.findFirst({
                where: {
                    userId,
                    cycleId: participation.cycleId
                },
                orderBy: { createdAt: 'desc' }
            });
            const multiplier = latestMultiplier?.multiplier || 1.0;
            const effectiveOwnership = totalOwnership * multiplier;
            return {
                cycle: participation.cycle,
                participation,
                totalOwnership,
                multiplier,
                effectiveOwnership,
                entriesCount: ledgerEntries.length
            };
        }));
        res.json(ownershipSummary);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=ownership.js.map