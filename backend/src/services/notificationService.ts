import { prisma } from '../config/database';

export class NotificationService {
  static async createNotification(
    userId: string,
    type: string,
    message: string,
    metadata?: Record<string, unknown>
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

  static async createActivityVerification(userId: string, activityId: string, verified: string, feedbackComment?: string) {
    let message = verified === 'verified' 
      ? 'Your activity has been verified and ownership has been awarded.'
      : verified === 'rejected'
      ? 'Your activity submission was rejected.'
      : 'Changes have been requested for your activity submission.';

    if (feedbackComment) {
      message += ` Admin feedback: ${feedbackComment}`;
    }

    return this.createNotification(
      userId,
      'activity_verified',
      message,
      { activityId, verified, feedbackComment }
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

  static async createOwnershipDecay(userId: string, cycleId: string, decayAmount: number, stallStage: string) {
    const decayPercentage = stallStage === 'paused' ? 10 : 5;
    const message = `Your provisional ownership has decreased by ${decayPercentage}% due to inactivity (${stallStage} stage).`;

    return this.createNotification(
      userId,
      'ownership_decay',
      message,
      { cycleId, decayAmount, stallStage }
    );
  }

  static async createStallRecovery(userId: string, cycleId: string, previousStage: string) {
    const message = 'Welcome back! Your participation status has been restored to active.';

    return this.createNotification(
      userId,
      'stall_recovery',
      message,
      { cycleId, previousStage, recoveredAt: new Date() }
    );
  }

  static async createCycleFinalized(userId: string, cycleId: string, cycleName: string, finalOwnership: number) {
    const message = `Build cycle "${cycleName}" has been finalized. Your final ownership: ${finalOwnership.toFixed(4)} (${(finalOwnership * 100).toFixed(2)}%)`;

    return this.createNotification(
      userId,
      'cycle_finalized',
      message,
      { cycleId, cycleName, finalOwnership }
    );
  }

  static async createUserMention(userId: string, cycleId: string, mentionedBy: string, messageId: string) {
    const mentioner = await prisma.user.findUnique({
      where: { id: mentionedBy },
      select: { name: true, email: true }
    });

    const message = `${mentioner?.name || mentioner?.email || 'Someone'} mentioned you in a cycle discussion`;

    return this.createNotification(
      userId,
      'user_mentioned',
      message,
      { cycleId, mentionedBy, messageId }
    );
  }

  static async createAdminMessage(userId: string, message: string, metadata?: Record<string, unknown>) {
    return this.createNotification(
      userId,
      'admin_message',
      message,
      metadata
    );
  }

  // Bulk notification creation for cycle events
  static async notifyAllCycleParticipants(cycleId: string, type: string, message: string, metadata?: Record<string, unknown>) {
    try {
      const participants = await prisma.cycleParticipation.findMany({
        where: { cycleId, optedIn: true },
        select: { userId: true }
      });

      const notifications = participants.map(p => ({
        userId: p.userId,
        type,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        sent: true,
        sentAt: new Date()
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      return notifications.length;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }
}