-- ============================================================
-- CRITICAL INTEGRITY FIXES MIGRATION
-- Non-destructive: all changes are additive or constraint-only
-- ============================================================

-- ISSUE 2: Task status extended to support activity-driven completion
-- Add 'submitted' and 'approved' to the status lifecycle
-- (No ALTER TYPE needed for PostgreSQL string columns — values are enforced at app layer)

-- ISSUE 3 & 4: Task claim system — add maxAssignments + claimedAt/submittedAt to TaskAssignment
ALTER TABLE "task_assignments"
  ADD COLUMN IF NOT EXISTS "claimedAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "submittedAt"  TIMESTAMPTZ;

-- Rename 'completed' status to support new lifecycle at DB level via app logic
-- (status values: assigned → in_progress → submitted → approved)
-- No column change needed; string column already flexible.

-- ISSUE 3: maxAssignments on Task to cap concurrent claimants
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "maxAssignments" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "starterWeight"  FLOAT   NOT NULL DEFAULT 1.0;
-- starterWeight: Issue 7 — starter tasks use reduced weight (e.g. 0.2)

-- ISSUE 6: Unique constraint on triage email to prevent duplicate submissions
-- Use a partial unique index so only PENDING submissions are deduplicated
-- (approved/rejected can have same email if re-applying after rejection)
CREATE UNIQUE INDEX IF NOT EXISTS "triage_submissions_email_pending_unique"
  ON "triage_submissions" ("email")
  WHERE "status" = 'PENDING';

-- ISSUE 8: Cycle metrics baseline — track initialization state
ALTER TABLE "build_cycles"
  ADD COLUMN IF NOT EXISTS "metricsInitialized" BOOLEAN NOT NULL DEFAULT FALSE;

-- ISSUE 10: Unified audit log entries for new systems
-- AdminActionLog already exists; add entityType/entityId for structured querying
ALTER TABLE "admin_action_logs"
  ADD COLUMN IF NOT EXISTS "entityType" TEXT,
  ADD COLUMN IF NOT EXISTS "entityId"   TEXT;

-- Performance indexes for new query patterns
CREATE INDEX IF NOT EXISTS "task_assignments_status_idx"    ON "task_assignments" ("status");
CREATE INDEX IF NOT EXISTS "task_assignments_taskId_idx"    ON "task_assignments" ("taskId");
CREATE INDEX IF NOT EXISTS "tasks_maxAssignments_idx"       ON "tasks" ("maxAssignments");
CREATE INDEX IF NOT EXISTS "triage_submissions_email_idx"   ON "triage_submissions" ("email");
CREATE INDEX IF NOT EXISTS "build_cycles_metricsInit_idx"   ON "build_cycles" ("metricsInitialized");
