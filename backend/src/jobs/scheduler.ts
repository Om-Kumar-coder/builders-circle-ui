import cron from 'node-cron';
import { StallEvaluatorJob } from './stallEvaluator';
import { AdjustMultiplierJob } from './adjustMultiplier';
import { ActivityArchiverJob } from './activityArchiver';
import { OwnershipDecayJob } from './ownershipDecay';
import { CycleFinalizerJob } from './cycleFinalizer';
import { prisma } from '../config/database';

export class JobScheduler {
  static start() {
    console.log('Starting job scheduler...');

    // Run stall evaluator daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('Running daily stall evaluator job');
      try {
        await StallEvaluatorJob.run();
      } catch (error) {
        console.error('Stall evaluator job failed:', error);
      }
    });

    // Run multiplier adjustment daily at 3 AM (after stall evaluator)
    cron.schedule('0 3 * * *', async () => {
      console.log('Running daily multiplier adjustment job');
      try {
        await AdjustMultiplierJob.run();
      } catch (error) {
        console.error('Multiplier adjustment job failed:', error);
      }
    });

    // Run ownership decay weekly on Sundays at 1 AM
    cron.schedule('0 1 * * 0', async () => {
      console.log('Running weekly ownership decay job');
      try {
        await OwnershipDecayJob.run();
      } catch (error) {
        console.error('Ownership decay job failed:', error);
      }
    });

    // Run cycle finalizer daily at 4 AM
    cron.schedule('0 4 * * *', async () => {
      console.log('Running daily cycle finalizer job');
      try {
        await CycleFinalizerJob.run();
      } catch (error) {
        console.error('Cycle finalizer job failed:', error);
      }
    });

    // Run activity archiver weekly on Sundays at 5 AM (after finalization)
    cron.schedule('0 5 * * 0', async () => {
      console.log('Running weekly activity archiver job');
      try {
        await ActivityArchiverJob.run();
      } catch (error) {
        console.error('Activity archiver job failed:', error);
      }
    });

    // Auto-resume leave: check every hour for expired leave periods
    cron.schedule('0 * * * *', async () => {
      try {
        const now = new Date();
        const expiredLeaves = await prisma.participationLeave.findMany({
          where: { status: 'paused', leaveEnd: { lt: now } },
        });
        for (const leave of expiredLeaves) {
          await prisma.participationLeave.update({
            where: { id: leave.id },
            data: { status: 'active' },
          });
          await prisma.cycleParticipation.updateMany({
            where: { userId: leave.userId, cycleId: leave.cycleId },
            data: { participationStatus: 'active', stallStage: 'none' },
          });
          await prisma.notification.create({
            data: {
              userId: leave.userId,
              type: 'participation_resumed',
              message: 'Your leave period has ended. Participation is now active.',
              metadata: JSON.stringify({ leaveId: leave.id }),
            },
          });
        }
        if (expiredLeaves.length > 0) {
          console.log(`Auto-resumed ${expiredLeaves.length} leave(s)`);
        }
      } catch (error) {
        console.error('Leave auto-resume job failed:', error);
      }
    });

    // Auto-mark overdue tasks daily at 1 AM
    cron.schedule('0 1 * * *', async () => {
      try {
        const now = new Date();
        const result = await prisma.task.updateMany({
          where: { status: 'open', dueDate: { lt: now } },
          data: { status: 'overdue' },
        });
        if (result.count > 0) console.log(`Marked ${result.count} task(s) as overdue`);
      } catch (error) {
        console.error('Task overdue job failed:', error);
      }
    });
    cron.schedule('*/15 * * * *', async () => {
      try {
        const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 min without heartbeat
        const staleSessions = await prisma.userActivitySession.findMany({
          where: { sessionEnd: null, lastHeartbeat: { lt: staleThreshold } },
        });
        const now = new Date();
        for (const s of staleSessions) {
          await prisma.userActivitySession.update({
            where: { id: s.id },
            data: {
              sessionEnd: now,
              durationMinutes: Math.floor((now.getTime() - s.sessionStart.getTime()) / 60000),
            },
          });
        }
        if (staleSessions.length > 0) {
          console.log(`Closed ${staleSessions.length} stale session(s)`);
        }
      } catch (error) {
        console.error('Stale session cleanup failed:', error);
      }
    });

    // Auto-revoke expired access grants — runs every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        const now = new Date();
        const expired = await prisma.accessGrant.findMany({
          where: { revokedAt: null, expiresAt: { lt: now } },
        });
        for (const grant of expired) {
          await prisma.accessGrant.update({
            where: { id: grant.id },
            data: { revokedAt: now, revokedBy: 'system' },
          });
          await prisma.notification.create({
            data: {
              userId: grant.userId,
              type: 'admin_message',
              message: `Your temporary access (${grant.type}) has expired and been automatically revoked.`,
              metadata: JSON.stringify({ grantId: grant.id, type: grant.type }),
            },
          });
        }
        if (expired.length > 0) {
          console.log(`Auto-revoked ${expired.length} expired access grant(s)`);
        }
      } catch (error) {
        console.error('Access grant expiry job failed:', error);
      }
    });

    // Daily cleanup: delete expired revoked tokens (prevents table bloat)
    cron.schedule('0 0 * * *', async () => {
      try {
        const result = await prisma.revokedToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        if (result.count > 0) console.log(`Cleaned up ${result.count} expired revoked token(s)`);
      } catch (error) {
        console.error('Revoked token cleanup failed:', error);
      }
    });

    console.log('Job scheduler started successfully');  }

  // Manual job execution for testing/admin purposes
  static async runStallEvaluator() {
    return StallEvaluatorJob.run();
  }

  static async runMultiplierAdjustment() {
    return AdjustMultiplierJob.run();
  }

  static async runActivityArchiver() {
    return ActivityArchiverJob.run();
  }

  static async runOwnershipDecay() {
    return OwnershipDecayJob.run();
  }

  static async runCycleFinalizer() {
    return CycleFinalizerJob.run();
  }

  static async finalizeCycle(cycleId: string) {
    return CycleFinalizerJob.finalizeCycleById(cycleId);
  }
}