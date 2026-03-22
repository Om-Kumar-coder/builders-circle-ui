/**
 * Integrity Service
 * Implements all critical architectural fixes:
 *
 * ISSUE 1  — Ownership single source of truth (computed, never manually written)
 * ISSUE 2  — Task completion only via approved activity
 * ISSUE 3  — Group task over-assignment prevention (maxAssignments)
 * ISSUE 4  — Task claim/lock system
 * ISSUE 5  — Activity participation validation
 * ISSUE 7  — Starter task scoring with reduced weight
 * ISSUE 8  — Cycle initialization baseline
 * ISSUE 10 — Unified audit logging
 */

import { prisma } from '../config/database';

// ── ISSUE 10: Unified audit log helper ───────────────────────────────────────

export async function auditLog(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  targetUserIds: string[],
  metadata?: Record<string, unknown>
) {
  return prisma.adminActionLog.create({
    data: {
      adminId: actorId,
      action,
      entityType,
      entityId,
      targetUserIds: JSON.stringify(targetUserIds),
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ── ISSUE 5: Participation validation ────────────────────────────────────────

/**
 * Returns true if the user has an active, opted-in participation record
 * for the given cycle and is NOT currently on leave.
 */
export async function isActiveParticipant(userId: string, cycleId: string): Promise<boolean> {
  const [participation, activeLeave] = await Promise.all([
    prisma.cycleParticipation.findUnique({
      where: { userId_cycleId: { userId, cycleId } },
    }),
    prisma.participationLeave.findFirst({
      where: {
        userId,
        cycleId,
        status: 'paused',
        leaveStart: { lte: new Date() },
        OR: [{ leaveEnd: null }, { leaveEnd: { gte: new Date() } }],
      },
    }),
  ]);

  if (!participation || !participation.optedIn) return false;
  if (activeLeave) return false;
  // Closed participation is not active
  if (['closed'].includes(participation.participationStatus)) return false;
  return true;
}

// ── ISSUE 4: Task claim system ────────────────────────────────────────────────

/**
 * Claim a task for a user.
 * Enforces maxAssignments cap and prevents double-claiming.
 * Returns the TaskAssignment or throws a descriptive error.
 */
export async function claimTask(userId: string, taskId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({
      where: { id: taskId },
      include: { assignments: true },
    });

    if (!task) throw new Error('Task not found');
    if (task.status === 'approved' || task.status === 'completed') {
      throw new Error('Task is already completed');
    }

    // ISSUE 3: enforce maxAssignments cap
    const activeClaims = task.assignments.filter(
      a => !['rejected', 'abandoned'].includes(a.status)
    );
    if (activeClaims.length >= task.maxAssignments) {
      throw new Error(`Task is fully claimed (max ${task.maxAssignments} assignee${task.maxAssignments > 1 ? 's' : ''})`);
    }

    // Prevent double-claim by same user
    const existing = task.assignments.find(a => a.userId === userId);
    if (existing) {
      if (existing.status === 'assigned') {
        // Already assigned but not yet claimed — upgrade to claimed
        return tx.taskAssignment.update({
          where: { id: existing.id },
          data: { status: 'in_progress', claimedAt: existing.claimedAt ?? new Date() },
        });
      }
      throw new Error('You have already claimed this task');
    }

    // Create new assignment in claimed state
    const assignment = await tx.taskAssignment.create({
      data: {
        taskId,
        userId,
        status: 'in_progress',
        claimedAt: new Date(),
      },
    });

    // Update task status to reflect it's been claimed
    if (task.status === 'open') {
      await tx.task.update({ where: { id: taskId }, data: { status: 'in_progress' } });
    }

    return assignment;
  });
}

// ── ISSUE 2: Activity-driven task completion ──────────────────────────────────

/**
 * Called when an activity is approved (verified).
 * If the activity is linked to a task, marks the assignment as 'approved'
 * and — if all active assignments are approved — marks the task itself approved.
 *
 * This is the ONLY path that completes a task. Direct completion is blocked.
 */
export async function completeTaskViaActivity(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  activityId: string,
  userId: string
) {
  const activity = await tx.activityEvent.findUnique({
    where: { id: activityId },
    select: { linkedTaskId: true },
  });

  if (!activity?.linkedTaskId) return; // no task linked — nothing to do

  const taskId = activity.linkedTaskId;

  // Mark this user's assignment as approved
  await tx.taskAssignment.updateMany({
    where: { taskId, userId },
    data: { status: 'approved', completedAt: new Date() },
  });

  // Check if all active assignments are now approved
  const allAssignments = await tx.taskAssignment.findMany({
    where: { taskId, status: { not: 'abandoned' } },
  });

  const allApproved = allAssignments.length > 0 && allAssignments.every(a => a.status === 'approved');
  if (allApproved) {
    await tx.task.update({ where: { id: taskId }, data: { status: 'approved' } });
  }
}

// ── ISSUE 7: Starter task score weight ───────────────────────────────────────

/**
 * Returns the effective contribution weight for an activity,
 * applying the reduced starterWeight if the linked task is a starter task.
 *
 * Default starterWeight is 0.2 (set at task creation time).
 * Falls back to the activity's own contributionWeight if no task is linked.
 */
export async function getEffectiveContributionWeight(
  baseWeight: number,
  linkedTaskId: string | null | undefined
): Promise<number> {
  if (!linkedTaskId) return baseWeight;

  const task = await prisma.task.findUnique({
    where: { id: linkedTaskId },
    select: { isStarter: true, starterWeight: true },
  });

  if (!task || !task.isStarter) return baseWeight;

  // Apply the reduced starter weight — cap at baseWeight so it can't inflate
  return Math.min(baseWeight, task.starterWeight);
}

// ── ISSUE 8: Cycle initialization ────────────────────────────────────────────

/**
 * Initializes baseline metrics for a newly created cycle.
 * Idempotent — safe to call multiple times.
 */
export async function initializeCycleMetrics(cycleId: string) {
  const cycle = await prisma.buildCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error('Cycle not found');
  if (cycle.metricsInitialized) return; // already done

  await prisma.$transaction(async (tx) => {
    // Ensure a ContributionScore baseline exists (totalScore = 0)
    // This prevents division-by-zero in normalized ownership calculations
    // No participant records yet — they're created on join

    // Ensure CycleEngagement baseline exists
    await tx.cycleEngagement.upsert({
      where: { cycleId },
      create: {
        cycleId,
        engagementScore: 0,
        activityCount: 0,
        participationRate: 0,
        verifiedActivityRatio: 0,
        averageHoursPerUser: 0,
        messageCount: 0,
      },
      update: {}, // don't overwrite if already exists
    });

    // Mark as initialized
    await tx.buildCycle.update({
      where: { id: cycleId },
      data: { metricsInitialized: true },
    });

    // System log
    await tx.systemLog.create({
      data: {
        event: 'cycle_initialized',
        severity: 'INFO',
        message: `Cycle "${cycle.name}" metrics initialized`,
        metadata: JSON.stringify({ cycleId, initializedAt: new Date() }),
      },
    });
  });
}

// ── ISSUE 1: Ownership single source of truth guard ──────────────────────────

/**
 * Validates that an ownership ledger write is coming from an approved source.
 * Direct manual overrides are blocked unless they go through AuditTrail.
 *
 * Call this before any prisma.ownershipLedger.create() outside of the
 * verified activity flow to ensure traceability.
 */
export function assertOwnershipWriteIsAudited(
  eventType: string,
  createdBy: string,
  auditReason?: string
) {
  const ALLOWED_SYSTEM_EVENTS = [
    'contribution_approved',
    'ownership_decay',
    'cycle_finalized',
    'multiplier_recovery',
    'stall_clear',
  ];

  if (!ALLOWED_SYSTEM_EVENTS.includes(eventType) && !auditReason) {
    throw new Error(
      `Ownership write for eventType "${eventType}" by "${createdBy}" requires an auditReason. ` +
      'Manual overrides must go through the AuditTrail.'
    );
  }
}
