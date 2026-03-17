import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authMiddleware, roleMiddleware, stepUpMiddleware, AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';
import { triggerEmail } from '../services/emailService';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function logAdminAction(
  adminId: string,
  action: string,
  targetUserIds: string[],
  metadata?: Record<string, unknown>
) {
  await prisma.adminActionLog.create({
    data: {
      adminId,
      action,
      targetUserIds: JSON.stringify(targetUserIds),
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ── POST /admin/bulk-action ───────────────────────────────────────────────────

const bulkActionSchema = z.object({
  action: z.enum(['grant_access', 'revoke_access', 'force_logout', 'remove_from_cycle', 'assign_task', 'change_role']),
  userIds: z.array(z.string()).min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  '/bulk-action',
  authMiddleware,
  roleMiddleware(['admin', 'founder']),
  stepUpMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { action, userIds, metadata } = bulkActionSchema.parse(req.body);
      const adminId = req.user!.id;

      // Safety: prevent admin from targeting themselves in destructive actions
      const destructive = ['force_logout', 'revoke_access', 'remove_from_cycle'];
      if (destructive.includes(action) && userIds.includes(adminId)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'You cannot perform this action on your own account.',
        });
      }

      const results: { userId: string; success: boolean; error?: string }[] = [];

      for (const userId of userIds) {
        try {
          switch (action) {
            case 'grant_access': {
              const type = (metadata?.type as string) || 'feature';
              const value = (metadata?.value as string) || null;
              const expiresAt = metadata?.expiresAt ? new Date(metadata.expiresAt as string) : null;
              if (expiresAt && expiresAt <= new Date()) {
                results.push({ userId, success: false, error: 'Expiry date must be in the future' });
                continue;
              }
              await prisma.accessGrant.create({
                data: { userId, grantedBy: adminId, type, value: value ?? undefined, expiresAt: expiresAt ?? undefined },
              });
              await NotificationService.createNotification(
                userId, 'admin_message',
                `Access granted: ${type}${value ? ` (${value})` : ''}${expiresAt ? ` — expires ${expiresAt.toLocaleDateString()}` : ''}`,
                { action: 'grant_access', type, value, expiresAt }
              ).catch(() => {});
              const grantTarget = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
              if (grantTarget) {
                triggerEmail('ACCESS_GRANTED', {
                  email: grantTarget.email, name: grantTarget.name,
                  accessType: type, accessValue: value ?? undefined,
                  expiresAt: expiresAt ? expiresAt.toLocaleString() : undefined,
                  timestamp: new Date().toISOString(),
                }).catch(() => {});
              }
              break;
            }

            case 'revoke_access': {
              const type = metadata?.type as string | undefined;
              await prisma.accessGrant.updateMany({
                where: { userId, revokedAt: null, ...(type ? { type } : {}) },
                data: { revokedAt: new Date(), revokedBy: adminId },
              });
              await NotificationService.createNotification(
                userId, 'admin_message',
                `Your access${type ? ` (${type})` : ''} has been revoked by an admin.`,
                { action: 'revoke_access', type }
              ).catch(() => {});
              const revokeTarget = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
              if (revokeTarget) {
                triggerEmail('ACCESS_REVOKED', {
                  email: revokeTarget.email, name: revokeTarget.name,
                  accessType: type, timestamp: new Date().toISOString(),
                }).catch(() => {});
              }
              break;
            }

            case 'force_logout': {
              // Revoke all tokens for this user (real invalidation)
              await prisma.user.update({
                where: { id: userId },
                data: { tokenRevokedAt: new Date() },
              });
              // Also close activity sessions
              await prisma.userActivitySession.updateMany({
                where: { userId, sessionEnd: null },
                data: { sessionEnd: new Date() },
              });
              await NotificationService.createNotification(
                userId, 'security_alert',
                'You have been logged out by an administrator.',
                { action: 'force_logout', by: adminId }
              ).catch(() => {});
              break;
            }

            case 'remove_from_cycle': {
              const cycleId = metadata?.cycleId as string | undefined;
              if (!cycleId) { results.push({ userId, success: false, error: 'cycleId required' }); continue; }
              await prisma.cycleParticipation.updateMany({
                where: { userId, cycleId },
                data: { optedIn: false, participationStatus: 'removed' },
              });
              break;
            }

            case 'assign_task': {
              const taskId = metadata?.taskId as string | undefined;
              if (!taskId) { results.push({ userId, success: false, error: 'taskId required' }); continue; }
              await prisma.taskAssignment.upsert({
                where: { taskId_userId: { taskId, userId } },
                create: { taskId, userId },
                update: { status: 'assigned' },
              });
              break;
            }

            case 'change_role': {
              const role = metadata?.role as string | undefined;
              if (!role) { results.push({ userId, success: false, error: 'role required' }); continue; }
              const allowed = ['founder', 'admin', 'contributor', 'employee', 'observer'];
              if (!allowed.includes(role)) { results.push({ userId, success: false, error: 'invalid role' }); continue; }
              // Founders only can assign founder role
              if (role === 'founder' && req.user!.role !== 'founder') {
                results.push({ userId, success: false, error: 'Only founders can assign founder role' }); continue;
              }
              await prisma.userProfile.update({ where: { userId }, data: { role } });
              await prisma.auditTrail.create({
                data: {
                  adminId,
                  action: 'role_change',
                  targetUserId: userId,
                  newValue: JSON.stringify({ role }),
                  reason: `Bulk role change to ${role}`,
                  timestamp: new Date(),
                },
              });
              break;
            }
          }
          results.push({ userId, success: true });
        } catch (err) {
          results.push({ userId, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      await logAdminAction(adminId, `bulk_${action}`, userIds, { metadata, results });

      res.json({ success: true, data: { results }, error: null });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, data: null, error: err.issues });
      res.status(500).json({ success: false, data: null, error: 'Internal server error' });
    }
  }
);

// ── POST /admin/grant-access ──────────────────────────────────────────────────

router.post(
  '/grant-access',
  authMiddleware,
  roleMiddleware(['admin', 'founder']),
  stepUpMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        userId: z.string(),
        type: z.string().min(1),
        value: z.string().optional(),
        expiresAt: z.string().datetime().optional(),
      });
      const { userId, type, value, expiresAt } = schema.parse(req.body);

      if (expiresAt && new Date(expiresAt) <= new Date()) {
        return res.status(400).json({ success: false, data: null, error: 'Expiry date must be in the future.' });
      }

      const grant = await prisma.accessGrant.create({
        data: {
          userId,
          grantedBy: req.user!.id,
          type,
          value,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        },
      });

      await logAdminAction(req.user!.id, 'grant_access', [userId], { type, value, expiresAt });
      await prisma.auditTrail.create({
        data: {
          adminId: req.user!.id,
          action: 'grant_access',
          targetUserId: userId,
          newValue: JSON.stringify({ type, value, expiresAt }),
          reason: `Access granted: ${type}`,
          timestamp: new Date(),
        },
      });

      await NotificationService.createNotification(
        userId, 'admin_message',
        `Access granted: ${type}${value ? ` (${value})` : ''}${expiresAt ? ` — expires ${new Date(expiresAt).toLocaleDateString()}` : ''}`,
        { action: 'grant_access', type, value, expiresAt }
      ).catch(() => {});

      // Email notification
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (targetUser) {
        triggerEmail('ACCESS_GRANTED', {
          email: targetUser.email,
          name: targetUser.name,
          accessType: type,
          accessValue: value,
          expiresAt: expiresAt ? new Date(expiresAt).toLocaleString() : undefined,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      res.json({ success: true, data: grant, error: null });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, data: null, error: err.issues });
      res.status(500).json({ success: false, data: null, error: 'Internal server error' });
    }
  }
);

// ── POST /admin/revoke-access ─────────────────────────────────────────────────

router.post(
  '/revoke-access',
  authMiddleware,
  roleMiddleware(['admin', 'founder']),
  stepUpMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        userId: z.string(),
        type: z.string().optional(),
        grantId: z.string().optional(),
      });
      const { userId, type, grantId } = schema.parse(req.body);

      if (userId === req.user!.id) {
        return res.status(400).json({ success: false, data: null, error: 'Cannot revoke your own access.' });
      }

      const where = grantId
        ? { id: grantId, revokedAt: null as null }
        : { userId, revokedAt: null as null, ...(type ? { type } : {}) };

      await prisma.accessGrant.updateMany({
        where,
        data: { revokedAt: new Date(), revokedBy: req.user!.id },
      });

      await logAdminAction(req.user!.id, 'revoke_access', [userId], { type, grantId });
      await prisma.auditTrail.create({
        data: {
          adminId: req.user!.id,
          action: 'revoke_access',
          targetUserId: userId,
          newValue: JSON.stringify({ type, grantId }),
          reason: `Access revoked: ${type || 'all'}`,
          timestamp: new Date(),
        },
      });

      await NotificationService.createNotification(
        userId, 'admin_message',
        `Your access${type ? ` (${type})` : ''} has been revoked.`,
        { action: 'revoke_access', type }
      ).catch(() => {});

      // Email notification
      const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (targetUser) {
        triggerEmail('ACCESS_REVOKED', {
          email: targetUser.email,
          name: targetUser.name,
          accessType: type,
          timestamp: new Date().toISOString(),
        }).catch(() => {});
      }

      res.json({ success: true, data: { message: 'Access revoked' }, error: null });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ success: false, data: null, error: err.issues });
      res.status(500).json({ success: false, data: null, error: 'Internal server error' });
    }
  }
);

// ── GET /admin/access-grants/:userId ─────────────────────────────────────────

router.get(
  '/access-grants/:userId',
  authMiddleware,
  roleMiddleware(['admin', 'founder']),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const grants = await prisma.accessGrant.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          granter: { select: { id: true, email: true, name: true } },
        },
      });
      res.json({ success: true, data: grants, error: null });
    } catch {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' });
    }
  }
);

// ── GET /admin/action-logs ────────────────────────────────────────────────────

router.get(
  '/action-logs',
  authMiddleware,
  roleMiddleware(['admin', 'founder']),
  async (_req: AuthRequest, res: Response) => {
    try {
      const logs = await prisma.adminActionLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          admin: { select: { id: true, email: true, name: true } },
        },
      });
      res.json({ success: true, data: logs, error: null });
    } catch {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' });
    }
  }
);

export default router;
