/**
 * Routing Service — Phase 2c
 *
 * Takes an ApplicationScore result and the associated EntryIntake, determines
 * the appropriate route action, persists a RouteAssignment, and executes the
 * routing action (auto-create user for fast-track, notify founders for hold/VC-intro, etc.).
 *
 * All routes are fire-and-forget — routing failures never block the intake response.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import logger from '../../utils/logger';
import { NotificationService } from '../notificationService';
import type { SubScores, ScoringResult } from './applicationScoringService';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RouteType = 'onboarding' | 'gatekeeper' | 'founder_review' | 'vc_intro';
export type Priority = 'high' | 'normal' | 'low';

export interface RoutingDecision {
  entryIntakeId: string;
  route: RouteType;
  priority: Priority;
  reason: string;
  score: number;
  subScores: SubScores;
  intentType: string;
  /**
   * If autoOnboarding is true, the service attempted to create a user account
   * and send a welcome email.
   */
  autoOnboarding?: {
    userId: string;
    emailSent: boolean;
  };
}

// ── Routing Decision Logic ────────────────────────────────────────────────────

const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Determine the appropriate route for an application based on its score,
 * sub-scores, and intent type.
 *
 * Priority mapping:
 *   high   — auto-onboarding (fast track), investor pipeline (VC intro)
 *   normal — gatekeeper queue (standard)
 *   low    — founder review (hold)
 */
export function determineRoute(
  totalScore: number,
  subScores: SubScores,
  intentType: string,
  capitalRange: string | null | undefined,
): { route: RouteType; priority: Priority; reason: string } {
  // Fast track: score >= 0.75 → onboarding
  if (totalScore >= 0.75) {
    return {
      route: 'onboarding',
      priority: 'high',
      reason: `Fast-track application (score: ${(totalScore * 100).toFixed(1)}%) — auto-onboarding`,
    };
  }

  // VC intro: investor with capital > 50k AND high execution score
  if (
    intentType === 'invest' &&
    capitalRange &&
    subScores.capital >= 0.7 &&
    subScores.execution >= 0.6
  ) {
    return {
      route: 'vc_intro',
      priority: 'high',
      reason: `Investor (capital: ${capitalRange}) with strong execution — add to investor pipeline`,
    };
  }

  // Founder review: hold (score < 0.40) OR investor with capital ≥ 250k
  if (totalScore < 0.40) {
    return {
      route: 'founder_review',
      priority: 'low',
      reason: `Below threshold score (${(totalScore * 100).toFixed(1)}%) — requires founder review`,
    };
  }

  if (
    intentType === 'invest' &&
    capitalRange &&
    subScores.capital >= 1.0
  ) {
    return {
      route: 'founder_review',
      priority: 'high',
      reason: `High-value investor (capital: ${capitalRange}) — flag for founder outreach`,
    };
  }

  // Standard: 0.40–0.74 → gatekeeper queue (existing flow)
  return {
    route: 'gatekeeper',
    priority: 'normal',
    reason: `Standard score (${(totalScore * 100).toFixed(1)}%) — gatekeeper review`,
  };
}

// ── Auto-Onboarding (Fast Track) ─────────────────────────────────────────────

/**
 * Auto-create a user account for fast-track applicants.
 * Uses the same pattern as triage approval:
 *   - Creates user with empty password (user sets it via verify-email flow)
 *   - Creates UserProfile with 'contributor' role
 *   - Assigns to the default group
 *   - Sends welcome/verify email
 */
async function autoOnboardUser(
  fullName: string,
  email: string,
  groupId: string | null,
): Promise<{ userId: string; emailSent: boolean }> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // User already exists — just update group if needed
    if (groupId && !existingUser.groupId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { groupId },
      });
    }
    return { userId: existingUser.id, emailSent: false };
  }

  const verifyToken = crypto.randomBytes(32).toString('hex');

  // Find default group
  let effectiveGroupId = groupId;
  if (!effectiveGroupId) {
    const defaultGroup = await prisma.group.findFirst({ where: { isDefault: true } });
    effectiveGroupId = defaultGroup?.id ?? null;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: fullName,
      password: '', // User sets password via verify-email / set-password flow
      emailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpiry: new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS),
      onboardingStep: 0,
      onboardingCompleted: false,
      groupId: effectiveGroupId,
      profile: {
        create: { role: 'contributor' },
      },
    },
  });

  // Send welcome/verify email (non-blocking)
  let emailSent = false;
  try {
    const { Resend } = await import('resend');
    const { env } = await import('../../config/env');
    const resend = new Resend(env.RESEND_API_KEY);
    const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    const FROM = 'Builders Circle <noreply@triagebuilders.com>';

    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Welcome to Builder\'s Circle — Verify your email',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#fff;border-radius:12px">
          <div style="margin-bottom:24px">
            <span style="font-size:22px;font-weight:700;color:#6366f1">Builder's Circle</span>
          </div>
          <h2 style="margin:0 0 16px;font-size:20px;color:#111">Welcome to Builder's Circle 🎉</h2>
          <p style="color:#374151">Hi ${fullName},</p>
          <p style="color:#374151">Great news — your application has been <strong>fast-tracked</strong>! We're excited to have you join us.</p>
          <p style="color:#374151">Click the button below to verify your email and set up your account:</p>
          <a href="${verifyLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
            Verify Email &amp; Get Started
          </a>
          <p style="color:#9ca3af;font-size:13px">This link expires in 24 hours. Or copy: ${verifyLink}</p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb"/>
          <p style="color:#9ca3af;font-size:12px;margin:0">This is an automated message from Builder's Circle. Do not reply to this email.</p>
        </div>
      `,
    });
    emailSent = true;
  } catch (err) {
    logger.warn('[Routing] Failed to send welcome email to ' + email, { err });
  }

  return { userId: user.id, emailSent };
}

// ── Founder Notification ─────────────────────────────────────────────────────

/**
 * Find all active founder/admin users and notify them about an intake that
 * needs manual attention.
 */
async function notifyFounders(
  intakeId: string,
  fullName: string,
  email: string,
  route: RouteType,
  reason: string,
): Promise<void> {
  try {
    const founders = await prisma.userProfile.findMany({
      where: {
        role: { in: ['founder', 'admin'] },
        status: 'active',
      },
      select: { userId: true },
    });

    for (const founder of founders) {
      const notificationType =
        route === 'vc_intro'
          ? 'route_vc_intro'
          : 'route_founder_review';

      await NotificationService.createNotification(
        founder.userId,
        notificationType,
        `${route === 'vc_intro' ? 'Investor pipeline' : 'Founder review'} — ${fullName} (${email})`,
        {
          intakeId,
          fullName,
          email,
          route,
          reason,
          priority: route === 'vc_intro' ? 'high' : 'low',
        },
      ).catch(() => {});
    }
  } catch (err) {
    logger.warn('[Routing] Failed to notify founders for intake ' + intakeId, { err });
  }
}

// ── Main Routing Pipeline ────────────────────────────────────────────────────

/**
 * Execute the full routing pipeline for a scored application:
 * 1. Determine route / priority / reason
 * 2. Persist RouteAssignment
 * 3. Execute route action (auto-onboard, notify founders, etc.)
 * 4. Log to system_logs
 *
 * Fire-and-forget safe — never throws.
 */
export async function executeRouting(
  intakeId: string,
  fullName: string,
  email: string,
  intentType: string,
  capitalRange: string | null | undefined,
  scoringResult: ScoringResult,
): Promise<RoutingDecision | null> {
  try {
    const decision = determineRoute(
      scoringResult.totalScore,
      scoringResult.subScores,
      intentType,
      capitalRange,
    );

    // Persist RouteAssignment
    await prisma.routeAssignment.upsert({
      where: { entryIntakeId: intakeId },
      create: {
        entryIntakeId: intakeId,
        route: decision.route,
        priority: decision.priority,
        reason: decision.reason,
      },
      update: {
        route: decision.route,
        priority: decision.priority,
        reason: decision.reason,
      },
    });

    let autoOnboarding: { userId: string; emailSent: boolean } | undefined;

    // Execute route action
    switch (decision.route) {
      case 'onboarding': {
        const result = await autoOnboardUser(fullName, email, null);
        autoOnboarding = result;
        break;
      }
      case 'founder_review':
      case 'vc_intro': {
        await notifyFounders(intakeId, fullName, email, decision.route, decision.reason);
        break;
      }
      case 'gatekeeper':
        // No action needed — stays in gatekeeper queue
        break;
    }

    // Audit log
    await prisma.systemLog.create({
      data: {
        event: 'routing_decision',
        severity: 'INFO',
        message: `[Routing] ${intakeId} → ${decision.route} (${decision.priority}): ${decision.reason}`,
        metadata: JSON.stringify({
          entryIntakeId: intakeId,
          route: decision.route,
          priority: decision.priority,
          reason: decision.reason,
          score: scoringResult.totalScore,
          subScores: scoringResult.subScores,
          autoOnboarding,
        }),
      },
    }).catch(() => {});

    return {
      entryIntakeId: intakeId,
      route: decision.route,
      priority: decision.priority,
      reason: decision.reason,
      score: scoringResult.totalScore,
      subScores: scoringResult.subScores,
      intentType,
      autoOnboarding,
    };
  } catch (err) {
    logger.error('[Routing] executeRouting failed for ' + intakeId, { err });
    return null;
  }
}

/**
 * Resolve a route assignment (mark as completed).
 */
export async function resolveRouteAssignment(
  routeAssignmentId: string,
  resolvedBy: string,
): Promise<boolean> {
  try {
    await prisma.routeAssignment.update({
      where: { id: routeAssignmentId },
      data: {
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
    return true;
  } catch (err) {
    logger.error('[Routing] Failed to resolve route assignment ' + routeAssignmentId, { err });
    return false;
  }
}
