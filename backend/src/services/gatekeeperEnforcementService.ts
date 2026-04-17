/**
 * Gatekeeper Enforcement Service
 *
 * Central authority for all Gatekeeper → Admin workflow enforcement.
 * Every admin action on a triage submission or activity MUST pass through
 * enforceGatekeeperDecision() before proceeding.
 *
 * Decision tiers:
 *   APPROVED  → allowed immediately
 *   VALID     → allowed immediately (Veronica cleared it)
 *   PENDING   → allowed with warning (not yet reviewed)
 *   NEEDS_REVIEW → allowed with warning
 *   SENT_BACK → allowed with warning
 *   FLAGGED   → blocked unless admin provides overrideReason
 *   REJECTED  → blocked unless admin provides overrideReason
 *   AUTO_BLOCK (aiDecision) → blocked unless admin provides overrideReason
 */

import { prisma } from '../config/database';
import logger from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnforcementResult {
  /** Whether the admin action is allowed to proceed without override */
  allowed: boolean;
  /** Human-readable reason when blocked */
  blockReason: string;
  /** Current GatekeeperReview status (null if no review exists yet) */
  gatekeeperStatus: string | null;
  /** Veronica AI score (0–1) */
  aiScore: number | null;
  /** Veronica AI decision tier */
  aiDecision: string | null;
  /** Whether this was a fallback (rule-based) result */
  isFallback: boolean;
  /** True when no GatekeeperReview record exists — item was never scanned */
  missingReview?: boolean;
}

export interface OverrideLogParams {
  adminId: string;
  targetUserId: string;
  entityType: 'triage' | 'activity';
  entityId: string;
  previousStatus: string | null;
  reason: string;
  aiScore: number | null;
}

export interface NotifyOverrideParams {
  entityType: 'triage' | 'activity';
  entityId: string;
  adminId: string;
  reason: string;
  previousStatus: string | null;
}

// ── Statuses that block admin action without explicit override ────────────────

const BLOCKING_STATUSES = new Set(['FLAGGED', 'REJECTED']);
const BLOCKING_AI_DECISIONS = new Set(['AUTO_BLOCK']);
// Statuses that require gatekeeper approval before admin can verify
const REQUIRES_APPROVAL_STATUSES = new Set(['PENDING', 'NEEDS_REVIEW', 'SENT_BACK', 'VALID']);

// ── Core enforcement function ─────────────────────────────────────────────────

/**
 * Check whether an admin action is permitted given the current GatekeeperReview state.
 *
 * @param entityId  - TriageSubmission.id or ActivityEvent.id
 * @param type      - 'triage' | 'activity'
 */
export async function enforceGatekeeperDecision(
  entityId: string,
  type: 'triage' | 'activity'
): Promise<EnforcementResult> {
  const reviewId = type === 'triage' ? `intake-${entityId}` : `sub-${entityId}`;

  const review = await prisma.gatekeeperReview.findUnique({
    where: { id: reviewId },
    select: {
      status: true,
      veronicaScore: true,
      veronicaFlags: true,
      veronicaNotes: true,
    },
  }) as (Awaited<ReturnType<typeof prisma.gatekeeperReview.findUnique>> & { aiDecision?: string | null }) | null;

  // No review record at all — log a warning and allow, but surface the gap
  if (!review) {
    // Log that this entity has no gatekeeper review — admin should be aware
    prisma.systemLog.create({
      data: {
        event: 'gatekeeper_review_missing',
        severity: 'WARNING',
        message: `Admin action on ${type} ${entityId} — no GatekeeperReview record exists. Item was never scanned.`,
        metadata: JSON.stringify({ entityId, type, reviewId }),
      },
    }).catch(() => {});

    return {
      allowed: true,
      blockReason: '',
      gatekeeperStatus: null,
      aiScore: null,
      aiDecision: null,
      isFallback: false,
      missingReview: true,
    };
  }

  const flags: string[] = review.veronicaFlags ? JSON.parse(review.veronicaFlags) : [];
  const isFallback = flags.includes('ai_fallback') || flags.includes('parse_error');

  // Use stored aiDecision if available; fall back to deriving from score for legacy records
  let aiDecision: string | null = review.aiDecision ?? null;
  if (!aiDecision && review.veronicaScore !== null && review.veronicaScore !== undefined) {
    if (review.veronicaScore >= 0.75) aiDecision = 'AUTO_PASS';
    else if (review.veronicaScore <= 0.30) aiDecision = 'AUTO_BLOCK';
    else aiDecision = 'FLAGGED';
  }

  const isBlocked =
    BLOCKING_STATUSES.has(review.status) ||
    (aiDecision !== null && BLOCKING_AI_DECISIONS.has(aiDecision)) ||
    // For activities: require explicit APPROVED status — VALID/PENDING/NEEDS_REVIEW are not enough
    (type === 'activity' && REQUIRES_APPROVAL_STATUSES.has(review.status));

  if (isBlocked) {
    const reason =
      review.status === 'REJECTED'
        ? `Gatekeeper has REJECTED this ${type}. An override with reason is required to proceed.`
        : aiDecision === 'AUTO_BLOCK'
        ? `Veronica AI has AUTO_BLOCKED this ${type} (score: ${review.veronicaScore?.toFixed(2)}). An override with reason is required.`
        : REQUIRES_APPROVAL_STATUSES.has(review.status)
        ? `Gatekeeper approval required. Current status: ${review.status}. A gatekeeper must review and APPROVE this submission before admin verification.`
        : `This ${type} is FLAGGED by Veronica. An override with reason is required to proceed.`;

    // Log every blocked attempt — not just overrides
    prisma.systemLog.create({
      data: {
        event: 'gatekeeper_enforcement_block',
        severity: 'INFO',
        message: `Admin action blocked on ${type} ${entityId} — status: ${review.status}, aiDecision: ${aiDecision ?? 'none'}`,
        metadata: JSON.stringify({
          entityId,
          type,
          gatekeeperStatus: review.status,
          aiScore: review.veronicaScore,
          aiDecision,
          isFallback,
        }),
      },
    }).catch(() => {});

    return {
      allowed: false,
      blockReason: reason,
      gatekeeperStatus: review.status,
      aiScore: review.veronicaScore ?? null,
      aiDecision,
      isFallback,
    };
  }

  return {
    allowed: true,
    blockReason: '',
    gatekeeperStatus: review.status,
    aiScore: review.veronicaScore ?? null,
    aiDecision,
    isFallback,
  };
}

// ── Override audit log ────────────────────────────────────────────────────────

/**
 * Write an AuditTrail entry whenever an admin overrides a gatekeeper block.
 */
export async function logGatekeeperOverride(params: OverrideLogParams): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        adminId: params.adminId,
        action: 'OVERRIDE_GATEKEEPER',
        targetUserId: params.targetUserId,
        previousValue: JSON.stringify({
          gatekeeperStatus: params.previousStatus,
          aiScore: params.aiScore,
          entityType: params.entityType,
          entityId: params.entityId,
        }),
        newValue: JSON.stringify({ overrideReason: params.reason }),
        reason: params.reason,
      },
    });

    await prisma.systemLog.create({
      data: {
        event: 'gatekeeper_override',
        severity: 'WARNING',
        message: `Admin ${params.adminId} overrode gatekeeper decision on ${params.entityType} ${params.entityId}`,
        userId: params.adminId,
        metadata: JSON.stringify({
          entityType: params.entityType,
          entityId: params.entityId,
          previousStatus: params.previousStatus,
          aiScore: params.aiScore,
          reason: params.reason,
        }),
      },
    });
  } catch (err) {
    logger.error('[GatekeeperEnforcement] Failed to log override', { err, params });
  }
}

// ── Notify gatekeeper of override ────────────────────────────────────────────

/**
 * Send an in-app notification to all users with the gatekeeper role
 * when an admin overrides their decision.
 */
export async function notifyGatekeeperOfOverride(params: NotifyOverrideParams): Promise<void> {
  try {
    // Single query — UserProfile is indexed on userId, role is a string field
    const [gatekeepers, admin] = await Promise.all([
      prisma.userProfile.findMany({
        where: { role: 'gatekeeper' },
        select: { userId: true },
      }),
      prisma.user.findUnique({
        where: { id: params.adminId },
        select: { name: true, email: true },
      }),
    ]);

    if (gatekeepers.length === 0) return;

    const adminLabel = admin?.name ?? admin?.email ?? params.adminId;
    const message = `Admin "${adminLabel}" overrode your ${params.entityType} decision (was: ${params.previousStatus ?? 'unknown'}). Reason: ${params.reason}`;

    await prisma.notification.createMany({
      data: gatekeepers.map(gk => ({
        userId: gk.userId,
        type: 'admin_message',
        message,
        metadata: JSON.stringify({
          event: 'gatekeeper_override',
          entityType: params.entityType,
          entityId: params.entityId,
          adminId: params.adminId,
          previousStatus: params.previousStatus,
          reason: params.reason,
        }),
      })),
    });
  } catch (err) {
    logger.error('[GatekeeperEnforcement] Failed to notify gatekeepers', { err, params });
  }
}

// ── Sync GatekeeperReview after admin final action ────────────────────────────

/**
 * After admin takes a final action (approve/reject), update the GatekeeperReview
 * so it reflects the resolved state. Prevents stale FLAGGED items in reports.
 *
 * @param entityId   - TriageSubmission.id or ActivityEvent.id
 * @param type       - 'triage' | 'activity'
 * @param adminAction - 'approved' | 'rejected' | 'verified' | 'changes_requested'
 * @param adminId    - ID of the admin who took the action
 */
export async function syncGatekeeperReviewOnAdminAction(
  entityId: string,
  type: 'triage' | 'activity',
  adminAction: 'approved' | 'rejected' | 'verified' | 'changes_requested',
  adminId: string
): Promise<void> {
  const reviewId = type === 'triage' ? `intake-${entityId}` : `sub-${entityId}`;

  const newStatus =
    adminAction === 'approved' || adminAction === 'verified' ? 'APPROVED' :
    adminAction === 'rejected' ? 'REJECTED' :
    'NEEDS_REVIEW'; // changes_requested

  try {
    await prisma.gatekeeperReview.updateMany({
      where: { id: reviewId },
      data: {
        status: newStatus,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    // Non-fatal — log but don't crash the admin action
    logger.error('[GatekeeperEnforcement] Failed to sync GatekeeperReview', { err, reviewId, adminAction });
  }
}
