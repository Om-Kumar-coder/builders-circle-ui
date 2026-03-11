"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnershipService = void 0;
const database_1 = require("../config/database");
class OwnershipService {
    static async computeOwnership(userId, cycleId) {
        try {
            // Get all ownership ledger entries for user in cycle
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
            return {
                success: true,
                totalOwnership,
                multiplier,
                effectiveOwnership,
                entriesCount: ledgerEntries.length
            };
        }
        catch (error) {
            console.error('Error computing ownership:', error);
            return {
                success: false,
                error: 'Failed to compute ownership'
            };
        }
    }
    static async createOwnershipEntry(userId, cycleId, eventType, ownershipAmount, sourceReference, createdBy) {
        try {
            // Get current multiplier
            const latestMultiplier = await database_1.prisma.multiplier.findFirst({
                where: { userId, cycleId },
                orderBy: { createdAt: 'desc' }
            });
            const multiplierSnapshot = latestMultiplier?.multiplier || 1.0;
            const entry = await database_1.prisma.ownershipLedger.create({
                data: {
                    userId,
                    cycleId,
                    eventType,
                    ownershipAmount,
                    multiplierSnapshot,
                    sourceReference,
                    createdBy: createdBy || 'system'
                }
            });
            return entry;
        }
        catch (error) {
            console.error('Error creating ownership entry:', error);
            throw error;
        }
    }
}
exports.OwnershipService = OwnershipService;
//# sourceMappingURL=ownershipService.js.map