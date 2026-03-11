import { prisma } from '../config/database';

export class NotificationService {
  static async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata?: any
  ) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          message,
          metadata: metadata ? JSON.stringify(metadata) : null,
          sent: true,
          sentAt: new Date()
        }
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  static async createStallWarning(userId: string, cycleId: string, stallStage: string) {
    const messages = {
      at_risk: 'You\'ve been inactive for 7+ days. Your participation is at risk.',
      diminishing: 'You\'ve been inactive for 14+ days. Your ownership multiplier is being reduced.',
      paused: 'You\'ve been inactive for 21+ days. Your participation has been paused.'
    };

    const message = messages[stallStage as keyof typeof messages] || 'Activity warning';

    return this.createNotification(
      userId,
      'stall_warning',
      message,
      { cycleId, stallStage }
    );
  }

  static async createActivityVerification(userId: string, activityId: string, verified: string) {
    const message = verified === 'verified' 
      ? 'Your activity has been verified and ownership has been awarded.'
      : 'Your activity submission was rejected. Please review and resubmit if needed.';

    return this.createNotification(
      userId,
      'activity_verified',
      message,
      { activityId, verified }
    );
  }

  static async createMultiplierChange(userId: string, cycleId: string, oldMultiplier: number, newMultiplier: number) {
    const message = `Your ownership multiplier has changed from ${oldMultiplier} to ${newMultiplier}.`;

    return this.createNotification(
      userId,
      'multiplier_changed',
      message,
      { cycleId, oldMultiplier, newMultiplier }
    );
  }

  static async createCycleStart(userId: string, cycleId: string, cycleName: string) {
    const message = `New build cycle "${cycleName}" has started. Join now to participate!`;

    return this.createNotification(
      userId,
      'cycle_started',
      message,
      { cycleId, cycleName }
    );
  }
}