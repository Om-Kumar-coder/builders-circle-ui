import { prisma } from '../config/database';
import { NotificationService } from './notificationService';
import { triggerEmail } from './emailService';
import crypto from 'crypto';

export type SecurityEventType =
  | 'new_login'
  | 'new_device'
  | 'password_changed'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'reauth'
  | 'role_change';

interface SecurityContext {
  ipAddress?: string;
  userAgent?: string;
}

export class SecurityService {
  /** Record a security event and optionally fire a notification + email */
  static async recordEvent(
    userId: string,
    eventType: SecurityEventType,
    ctx: SecurityContext,
    metadata?: Record<string, unknown>,
  ) {
    await prisma.securityEvent.create({
      data: {
        id: crypto.randomBytes(16).toString('hex'),
        userId,
        eventType,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }

  /**
   * Called on every successful login.
   * Detects whether the IP or device is new and fires alerts accordingly.
   */
  static async handleLogin(
    userId: string,
    email: string,
    name: string | null,
    ctx: SecurityContext,
  ) {
    const ip = ctx.ipAddress;
    const ua = ctx.userAgent;

    // Look at the last 30 days of sessions for this user
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = await prisma.userActivitySession.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { ipAddress: true, userAgent: true },
    });

    const knownIPs = new Set(recentSessions.map((s: { ipAddress: string | null }) => s.ipAddress).filter(Boolean));
    const knownUAs = new Set(recentSessions.map((s: { userAgent: string | null }) => s.userAgent).filter(Boolean));

    const isNewIP = ip && !knownIPs.has(ip);
    const isNewDevice = ua && !knownUAs.has(ua);

    if (isNewIP || isNewDevice) {
      const label = isNewDevice ? 'new device' : 'new location';
      const eventType: SecurityEventType = isNewDevice ? 'new_device' : 'new_login';

      await this.recordEvent(userId, eventType, ctx, { ip, ua });

      await NotificationService.createNotification(
        userId,
        'security_alert',
        `New login detected from a ${label}.${ip ? ` IP: ${ip}` : ''}`,
        { eventType, ip, ua, detectedAt: new Date().toISOString() },
      );

      // Fire a single email for new device/location
      triggerEmail('NEW_LOGIN', {
        email,
        name,
        ipAddress: ip ?? undefined,
        userAgent: ua ?? undefined,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    } else {
      // Still record the login event (no alert needed)
      await this.recordEvent(userId, 'new_login', ctx);
    }
  }

  static async handlePasswordChanged(
    userId: string,
    email: string,
    name: string | null,
    ctx: SecurityContext,
  ) {
    await this.recordEvent(userId, 'password_changed', ctx);
    await NotificationService.createNotification(
      userId,
      'security_alert',
      'Your password was changed. If this wasn\'t you, contact support immediately.',
      { eventType: 'password_changed', ip: ctx.ipAddress, changedAt: new Date().toISOString() },
    );
    triggerEmail('PASSWORD_CHANGED', {
      email,
      name,
      ipAddress: ctx.ipAddress,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }

  static async handle2FAChanged(
    userId: string,
    email: string,
    name: string | null,
    enabled: boolean,
    ctx: SecurityContext,
  ) {
    const eventType: SecurityEventType = enabled ? '2fa_enabled' : '2fa_disabled';
    await this.recordEvent(userId, eventType, ctx);
    await NotificationService.createNotification(
      userId,
      'security_alert',
      enabled
        ? 'Two-factor authentication was enabled on your account.'
        : 'Two-factor authentication was disabled on your account.',
      { eventType, ip: ctx.ipAddress, changedAt: new Date().toISOString() },
    );
    if (!enabled) {
      triggerEmail('2FA_DISABLED', {
        email,
        name,
        ipAddress: ctx.ipAddress,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    } else {
      triggerEmail('2FA_ENABLED', {
        email,
        name,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  static async getEvents(userId: string, limit = 20) {
    return prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
