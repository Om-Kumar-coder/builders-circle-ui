export declare class NotificationService {
    static createNotification(userId: string, type: string, message: string, metadata?: any): Promise<{
        message: string;
        type: string;
        id: string;
        read: boolean;
        metadata: string | null;
        sent: boolean;
        createdAt: Date;
        sentAt: Date | null;
        userId: string;
    }>;
    static createStallWarning(userId: string, cycleId: string, stallStage: string): Promise<{
        message: string;
        type: string;
        id: string;
        read: boolean;
        metadata: string | null;
        sent: boolean;
        createdAt: Date;
        sentAt: Date | null;
        userId: string;
    }>;
    static createActivityVerification(userId: string, activityId: string, verified: string): Promise<{
        message: string;
        type: string;
        id: string;
        read: boolean;
        metadata: string | null;
        sent: boolean;
        createdAt: Date;
        sentAt: Date | null;
        userId: string;
    }>;
    static createMultiplierChange(userId: string, cycleId: string, oldMultiplier: number, newMultiplier: number): Promise<{
        message: string;
        type: string;
        id: string;
        read: boolean;
        metadata: string | null;
        sent: boolean;
        createdAt: Date;
        sentAt: Date | null;
        userId: string;
    }>;
    static createCycleStart(userId: string, cycleId: string, cycleName: string): Promise<{
        message: string;
        type: string;
        id: string;
        read: boolean;
        metadata: string | null;
        sent: boolean;
        createdAt: Date;
        sentAt: Date | null;
        userId: string;
    }>;
}
//# sourceMappingURL=notificationService.d.ts.map