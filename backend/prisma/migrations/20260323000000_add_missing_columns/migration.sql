-- Add missing columns that existed in schema but not in the pre-existing database

-- scoreContribution on activity_events
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "scoreContribution" DOUBLE PRECISION;

-- normalizedOwnershipPct on ownership_ledger
ALTER TABLE "ownership_ledger" ADD COLUMN IF NOT EXISTS "normalizedOwnershipPct" DOUBLE PRECISION;

-- ipAddress / userAgent on user_activity_sessions (added in later SQLite migrations)
ALTER TABLE "user_activity_sessions" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "user_activity_sessions" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- editedAt on cycle_messages
ALTER TABLE "cycle_messages" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);

-- onboardingTourCompleted on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingTourCompleted" BOOLEAN NOT NULL DEFAULT false;

-- notificationPrefs on user_profiles
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "notificationPrefs" TEXT NOT NULL DEFAULT '{"stallWarnings":true,"activityReminders":true,"cycleUpdates":true}';

-- metricsInitialized on build_cycles
ALTER TABLE "build_cycles" ADD COLUMN IF NOT EXISTS "metricsInitialized" BOOLEAN NOT NULL DEFAULT false;

-- isLead on cycle_participation
ALTER TABLE "cycle_participation" ADD COLUMN IF NOT EXISTS "isLead" BOOLEAN NOT NULL DEFAULT false;

-- entityType / entityId on admin_action_logs
ALTER TABLE "admin_action_logs" ADD COLUMN IF NOT EXISTS "entityType" TEXT;
ALTER TABLE "admin_action_logs" ADD COLUMN IF NOT EXISTS "entityId" TEXT;

-- claimedAt / submittedAt on task_assignments
ALTER TABLE "task_assignments" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMPTZ;
ALTER TABLE "task_assignments" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ;

-- maxAssignments / starterWeight on tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "maxAssignments" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "starterWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "isStarter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

-- linkedTaskId on activity_events
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "linkedTaskId" TEXT;

-- groupId on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
