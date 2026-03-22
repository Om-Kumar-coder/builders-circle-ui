-- Migration: Add Group System, Triage Entry System, Idea Pipeline
-- New models: Group, TriageSubmission, Idea
-- New fields: User.groupId, Task.groupId, Task.isStarter,
--             ActivityEvent.linkedTaskId, CycleParticipation.isLead

-- 1. Groups table
CREATE TABLE IF NOT EXISTS "groups" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add groupId to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "groupId" TEXT REFERENCES "groups"("id") ON DELETE SET NULL;

-- 3. Add groupId and isStarter to tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "groupId" TEXT REFERENCES "groups"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "isStarter" BOOLEAN NOT NULL DEFAULT false;

-- 4. Add linkedTaskId to activity_events
ALTER TABLE "activity_events" ADD COLUMN IF NOT EXISTS "linkedTaskId" TEXT REFERENCES "tasks"("id") ON DELETE SET NULL;

-- 5. Add isLead to cycle_participation
ALTER TABLE "cycle_participation" ADD COLUMN IF NOT EXISTS "isLead" BOOLEAN NOT NULL DEFAULT false;

-- 6. TriageStatus enum values handled as TEXT in SQLite
CREATE TABLE IF NOT EXISTS "triage_submissions" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "roleType"       TEXT NOT NULL,
  "submissionType" TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "proofLinks"     TEXT,
  "availability"   TEXT,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy"     TEXT,
  "reviewedAt"     DATETIME,
  "rejectionNote"  TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. IdeaStatus enum values handled as TEXT in SQLite
CREATE TABLE IF NOT EXISTS "ideas" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "submittedBy"   TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"         TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "attachments"   TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy"    TEXT,
  "reviewedAt"    DATETIME,
  "rejectionNote" TEXT,
  "cycleId"       TEXT REFERENCES "build_cycles"("id") ON DELETE SET NULL,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_users_groupId" ON "users"("groupId");
CREATE INDEX IF NOT EXISTS "idx_tasks_groupId" ON "tasks"("groupId");
CREATE INDEX IF NOT EXISTS "idx_tasks_isStarter" ON "tasks"("isStarter");
CREATE INDEX IF NOT EXISTS "idx_activity_events_linkedTaskId" ON "activity_events"("linkedTaskId");
CREATE INDEX IF NOT EXISTS "idx_triage_submissions_status" ON "triage_submissions"("status");
CREATE INDEX IF NOT EXISTS "idx_ideas_submittedBy" ON "ideas"("submittedBy");
CREATE INDEX IF NOT EXISTS "idx_ideas_status" ON "ideas"("status");
