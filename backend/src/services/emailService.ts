import { Resend } from 'resend';
import { env } from '../config/env';

const resend = new Resend(env.RESEND_API_KEY);
const FROM = 'Builders Circle <noreply@triagebuilders.com>';

// ── Email event types ─────────────────────────────────────────────────────────

export type EmailEventType =
  | 'NEW_LOGIN'
  | 'PASSWORD_CHANGED'
  | '2FA_ENABLED'
  | '2FA_DISABLED'
  | 'ACCESS_GRANTED'
  | 'ACCESS_REVOKED'
  | 'AGREEMENT_ACCEPTED'
  | 'ONBOARDING_COMPLETE'
  | 'ONBOARDING_2FA_ENABLED'
  | 'ACCESS_TIER_ASSIGNED'
  | 'STALL_WARNING';

export interface EmailPayload {
  email: string;
  name?: string | null;
  // Event-specific fields
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
  role?: string;
  accessType?: string;
  accessValue?: string;
  expiresAt?: string;
  agreementVersion?: string;
  stallStage?: string;
  cycleId?: string;
  daysSinceLastActivity?: number;
}

// ── Shared template wrapper ───────────────────────────────────────────────────

function wrap(title: string, body: string, accentColor = '#6366f1') {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;border-radius:12px">
      <div style="margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:${accentColor}">Builder's Circle</span>
      </div>
      <h2 style="margin:0 0 16px;font-size:20px;color:#111">${title}</h2>
      ${body}
      <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
      <p style="color:#9ca3af;font-size:12px;margin:0">
        This is an automated message from Builder's Circle. Do not reply to this email.
      </p>
    </div>
  `;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap">${label}</td>
    <td style="padding:6px 0;color:#111;font-size:13px">${value}</td>
  </tr>`;
}

function table(rows: string) {
  return `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;padding:12px;margin:16px 0">${rows}</table>`;
}

// ── Event-driven trigger ──────────────────────────────────────────────────────

export async function triggerEmail(event: EmailEventType, payload: EmailPayload): Promise<void> {
  const { email, name } = payload;
  const displayName = name ?? 'there';
  const ts = payload.timestamp ?? new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

  try {
    switch (event) {
      case 'NEW_LOGIN': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'New login to your Builder\'s Circle account',
          html: wrap('New Login Detected', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">A new login was detected on your account.</p>
            ${table(
              row('Time', ts) +
              (payload.ipAddress ? row('IP Address', payload.ipAddress) : '') +
              (payload.userAgent ? row('Device', payload.userAgent.slice(0, 80)) : '')
            )}
            <p style="color:#374151">If this was you, no action is needed. If you don't recognise this login, change your password immediately.</p>
          `),
        });
        break;
      }

      case 'PASSWORD_CHANGED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Your Builder\'s Circle password was changed',
          html: wrap('Password Changed', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Your account password was successfully changed.</p>
            ${table(row('Time', ts) + (payload.ipAddress ? row('IP Address', payload.ipAddress) : ''))}
            <p style="color:#374151">If you did not make this change, contact support immediately and reset your password.</p>
          `, '#ef4444'),
        });
        break;
      }

      case '2FA_ENABLED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: '2FA enabled on your Builder\'s Circle account',
          html: wrap('Two-Factor Authentication Enabled', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Two-factor authentication has been <strong>enabled</strong> on your account. Your account is now more secure.</p>
            ${table(row('Time', ts))}
            <p style="color:#374151">If you did not enable 2FA, contact support immediately.</p>
          `, '#10b981'),
        });
        break;
      }

      case '2FA_DISABLED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: '⚠️ 2FA disabled on your Builder\'s Circle account',
          html: wrap('Two-Factor Authentication Disabled', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Two-factor authentication has been <strong>disabled</strong> on your account.</p>
            ${table(row('Time', ts) + (payload.ipAddress ? row('IP Address', payload.ipAddress) : ''))}
            <p style="color:#374151">If you did not do this, contact support immediately and re-enable 2FA.</p>
          `, '#ef4444'),
        });
        break;
      }

      case 'ACCESS_GRANTED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Access granted on Builder\'s Circle',
          html: wrap('Access Granted', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">You have been granted access on Builder's Circle.</p>
            ${table(
              (payload.accessType ? row('Access Type', payload.accessType) : '') +
              (payload.accessValue ? row('Value', payload.accessValue) : '') +
              (payload.expiresAt ? row('Expires', payload.expiresAt) : row('Expires', 'No expiry')) +
              row('Time', ts)
            )}
          `, '#6366f1'),
        });
        break;
      }

      case 'ACCESS_REVOKED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Access revoked on Builder\'s Circle',
          html: wrap('Access Revoked', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Your access has been revoked on Builder's Circle.</p>
            ${table(
              (payload.accessType ? row('Access Type', payload.accessType) : '') +
              (payload.accessValue ? row('Value', payload.accessValue) : '') +
              row('Time', ts)
            )}
            <p style="color:#374151">If you believe this is an error, contact your administrator.</p>
          `, '#ef4444'),
        });
        break;
      }

      case 'AGREEMENT_ACCEPTED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Agreement accepted — Builder\'s Circle',
          html: wrap('Agreement Accepted', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">You have successfully accepted the Builder's Circle agreement.</p>
            ${table(
              (payload.agreementVersion ? row('Version', payload.agreementVersion) : '') +
              row('Accepted At', ts)
            )}
          `, '#6366f1'),
        });
        break;
      }

      case 'ONBOARDING_COMPLETE': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Welcome to Builder\'s Circle 🎉',
          html: wrap('Welcome to Builder\'s Circle', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">You've completed onboarding and your account is fully set up. Welcome to Builder's Circle!</p>
            <p style="color:#374151">Here's what you can do now:</p>
            <ul style="color:#374151;padding-left:20px;line-height:1.8">
              <li>Join a Build Cycle and start contributing</li>
              <li>Submit activity to earn ownership</li>
              <li>Track your participation health on the dashboard</li>
            </ul>
            ${table(row('Onboarding Completed', ts))}
          `, '#10b981'),
        });
        break;
      }

      case 'ONBOARDING_2FA_ENABLED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: '2FA confirmed during onboarding — Builder\'s Circle',
          html: wrap('2FA Confirmed', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Two-factor authentication was successfully enabled as part of your onboarding. Your account is protected.</p>
            ${table(row('Time', ts))}
          `, '#10b981'),
        });
        break;
      }

      case 'ACCESS_TIER_ASSIGNED': {
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: 'Your access tier has been assigned — Builder\'s Circle',
          html: wrap('Access Tier Assigned', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Your access tier has been assigned on Builder's Circle.</p>
            ${table(
              (payload.role ? row('Role', payload.role) : '') +
              row('Assigned At', ts)
            )}
          `, '#6366f1'),
        });
        break;
      }
      case 'STALL_WARNING': {
        const stageLabels: Record<string, string> = {
          at_risk: 'At Risk',
          diminishing: 'Diminishing',
          paused: 'Paused',
        };
        const stageLabel = stageLabels[payload.stallStage ?? ''] ?? payload.stallStage ?? 'Unknown';
        await resend.emails.send({
          from: FROM,
          to: email,
          subject: `⚠️ Participation warning: ${stageLabel} — Builder's Circle`,
          html: wrap('Participation Warning', `
            <p style="color:#374151">Hi ${displayName},</p>
            <p style="color:#374151">Your participation status has changed to <strong>${stageLabel}</strong>.</p>
            ${table(
              row('Status', stageLabel) +
              (payload.daysSinceLastActivity !== undefined ? row('Days Since Last Activity', String(payload.daysSinceLastActivity)) : '') +
              row('Time', ts)
            )}
            <p style="color:#374151">Submit a verified activity to restore your active status and protect your ownership.</p>
          `, '#f59e0b'),
        });
        break;
      }
    }
  } catch (err) {
    // Non-blocking — log but don't throw
    console.error(`[EmailService] Failed to send ${event} email to ${email}:`, err);
  }
}

// ── Legacy methods (kept for backward compat) ─────────────────────────────────

export class EmailService {
  static async sendVerificationEmail(email: string, name: string | null, token: string) {
    const link = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Verify your email – Builders Circle',
      html: wrap('Verify Your Email', `
        <p style="color:#374151">Hi ${name ?? 'there'},</p>
        <p style="color:#374151">Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email
        </a>
        <p style="color:#9ca3af;font-size:13px">Or copy this link: ${link}</p>
      `),
    });
  }

  static async sendPasswordResetEmail(email: string, name: string | null, token: string) {
    const link = `${env.FRONTEND_URL}/reset-password?token=${token}`;
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Reset your password – Builders Circle',
      html: wrap('Reset Your Password', `
        <p style="color:#374151">Hi ${name ?? 'there'},</p>
        <p style="color:#374151">Click the button below to reset your password. This link expires in <strong>15 minutes</strong>.</p>
        <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
        <p style="color:#9ca3af;font-size:13px">Or copy this link: ${link}</p>
        <p style="color:#9ca3af;font-size:13px">If you did not request a password reset, ignore this email — your password will not change.</p>
      `, '#ef4444'),
    });
  }

  static async send2FACode(email: string, name: string | null, code: string) {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `${code} – Your Builders Circle login code`,
      html: wrap('Your Login Code', `
        <p style="color:#374151">Hi ${name ?? 'there'},</p>
        <p style="color:#374151">Your one-time login code is:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;margin:24px 0">${code}</div>
        <p style="color:#9ca3af;font-size:13px">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      `),
    });
  }

  static async sendSecurityAlert(
    email: string,
    name: string | null,
    alert: { event: string; detail: string; time: string },
  ) {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: `Security alert: ${alert.event} – Builders Circle`,
      html: wrap('Security Alert', `
        <p style="color:#374151">Hi ${name ?? 'there'},</p>
        <p style="color:#374151">We detected the following activity on your account:</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
          <strong style="color:#dc2626">${alert.event}</strong>
          <p style="margin:8px 0 0;color:#374151">${alert.detail}</p>
          <p style="margin:8px 0 0;color:#6b7280;font-size:13px">Time: ${alert.time}</p>
        </div>
        <p style="color:#374151">If this was you, no action is needed. If you don't recognise this activity, change your password immediately.</p>
      `, '#ef4444'),
    });
  }
}
