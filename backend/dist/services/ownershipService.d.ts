export declare class OwnershipService {
    static computeOwnership(userId: string, cycleId: string): Promise<{
        success: boolean;
        totalOwnership: number;
        multiplier: number;
        effectiveOwnership: number;
        entriesCount: number;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        totalOwnership?: undefined;
        multiplier?: undefined;
        effectiveOwnership?: undefined;
        entriesCount?: undefined;
    }>;
    static createOwnershipEntry(userId: string, cycleId: string, eventType: string, ownershipAmount: number, sourceReference?: string, createdBy?: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        cycleId: string;
        eventType: string;
        ownershipAmount: number;
        multiplierSnapshot: number;
        sourceReference: string | null;
        createdBy: string;
    }>;
}
//# sourceMappingURL=ownershipService.d.ts.map