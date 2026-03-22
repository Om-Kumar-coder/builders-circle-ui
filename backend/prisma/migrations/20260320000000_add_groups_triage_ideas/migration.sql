-- CreateEnum
CREATE TYPE "TriageStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable: groups
CREATE TABLE "groups" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isDefault"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable: triage_submissions
CREATE TABLE "triage_submissions" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "roleType"       TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "proofLinks"     JSONB,
    "availability"   TEXT,
    "status"         "TriageStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy"     TEXT,
    "reviewedAt"     TIMESTAMP(3),
    "rejectionNote"  TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triage_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ideas
CREATE TABLE "ideas" (
    "id"            TEXT NOT NULL,
    "submittedBy"   TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "description"   TEXT NOT NULL,
    "attachments"   JSONB,
    "status"        "IdeaStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy"    TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "rejectionNote" TEXT,
    "cycleId"       TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- AddColumn: users.groupId
ALTER TABLE "users" ADD COLUMN "groupId" TEXT;

-- AddColumn: tasks.groupId
ALTER TABLE "tasks" ADD COLUMN "groupId" TEXT;

-- AddColumn: tasks.isStarter
ALTER TABLE "tasks" ADD COLUMN "isStarter" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn: activity_events.linkedTaskId
ALTER TABLE "activity_events" ADD COLUMN "linkedTaskId" TEXT;

-- AddColumn: cycle_participation.isLead
ALTER TABLE "cycle_participation" ADD COLUMN "isLead" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey: users.groupId -> groups.id
ALTER TABLE "users" ADD CONSTRAINT "users_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: tasks.groupId -> groups.id
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: activity_events.linkedTaskId -> tasks.id
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_linkedTaskId_fkey"
    FOREIGN KEY ("linkedTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: ideas.submittedBy -> users.id
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_submittedBy_fkey"
    FOREIGN KEY ("submittedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ideas.cycleId -> build_cycles.id
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "users_groupId_idx" ON "users"("groupId");
CREATE INDEX "tasks_groupId_idx" ON "tasks"("groupId");
CREATE INDEX "tasks_isStarter_idx" ON "tasks"("isStarter");
CREATE INDEX "activity_events_linkedTaskId_idx" ON "activity_events"("linkedTaskId");
CREATE INDEX "triage_submissions_status_idx" ON "triage_submissions"("status");
CREATE INDEX "ideas_submittedBy_idx" ON "ideas"("submittedBy");
CREATE INDEX "ideas_status_idx" ON "ideas"("status");
