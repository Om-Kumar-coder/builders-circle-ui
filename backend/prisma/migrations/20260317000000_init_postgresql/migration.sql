-- PostgreSQL baseline migration — covers all tables from the original SQLite migrations
-- This replaces the old SQLite migration history with a clean PostgreSQL baseline.

-- Users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyExpiry" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingTourCompleted" BOOLEAN NOT NULL DEFAULT false,
    "tokenRevokedAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpiry" TIMESTAMP(3),
    "groupId" TEXT,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- User Profiles
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'contributor',
    "status" TEXT NOT NULL DEFAULT 'active',
    "bio" TEXT,
    "avatar" TEXT,
    "notificationPrefs" TEXT NOT NULL DEFAULT '{"stallWarnings":true,"activityReminders":true,"cycleUpdates":true}',
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- Groups
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- Build Cycles
CREATE TABLE "build_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "state" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "metricsInitialized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "build_cycles_pkey" PRIMARY KEY ("id")
);

-- Cycle Participation
CREATE TABLE "cycle_participation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "optedIn" BOOLEAN NOT NULL DEFAULT true,
    "participationStatus" TEXT NOT NULL,
    "stallStage" TEXT NOT NULL,
    "lastActivityDate" TIMESTAMP(3),
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cycle_participation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cycle_participation_userId_cycleId_key" ON "cycle_participation"("userId", "cycleId");

-- Activity Events
CREATE TABLE "activity_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "proofLink" TEXT NOT NULL,
    "description" TEXT,
    "hoursLogged" DOUBLE PRECISION,
    "workSummary" TEXT,
    "taskReference" TEXT,
    "linkedTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "feedbackComment" TEXT,
    "feedbackAuthor" TEXT,
    "feedbackTimestamp" TIMESTAMP(3),
    "contributionType" TEXT NOT NULL DEFAULT 'code',
    "contributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "calculatedOwnership" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "scoreContribution" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- Ownership Ledger
CREATE TABLE "ownership_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "ownershipAmount" DOUBLE PRECISION NOT NULL,
    "multiplierSnapshot" DOUBLE PRECISION NOT NULL,
    "sourceReference" TEXT,
    "createdBy" TEXT NOT NULL,
    "normalizedOwnershipPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ownership_ledger_pkey" PRIMARY KEY ("id")
);

-- Multipliers
CREATE TABLE "multipliers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "multipliers_pkey" PRIMARY KEY ("id")
);

-- Notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Disputes
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- Audit Trail
CREATE TABLE "audit_trail" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id")
);

-- Archived Activities
CREATE TABLE "archived_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "proofLink" TEXT NOT NULL,
    "description" TEXT,
    "verified" TEXT NOT NULL,
    "contributionType" TEXT NOT NULL DEFAULT 'code',
    "contributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "calculatedOwnership" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalId" TEXT NOT NULL,
    CONSTRAINT "archived_activities_pkey" PRIMARY KEY ("id")
);

-- System Logs
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- User Activity Sessions
CREATE TABLE "user_activity_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEnd" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "pageVisited" TEXT NOT NULL,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_activity_sessions_pkey" PRIMARY KEY ("id")
);

-- Contribution Weights
CREATE TABLE "contribution_weights" (
    "id" TEXT NOT NULL,
    "contributionType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contribution_weights_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contribution_weights_contributionType_key" ON "contribution_weights"("contributionType");

-- Cycle Messages
CREATE TABLE "cycle_messages" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "mentions" TEXT NOT NULL DEFAULT '[]',
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cycle_messages_pkey" PRIMARY KEY ("id")
);

-- Message Reads
CREATE TABLE "message_reads" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_reads_messageId_userId_key" ON "message_reads"("messageId", "userId");

-- Message Mentions
CREATE TABLE "message_mentions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "message_mentions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "message_mentions_messageId_userId_key" ON "message_mentions"("messageId", "userId");

-- Contributor Reputation
CREATE TABLE "contributor_reputation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "verifiedActivities" INTEGER NOT NULL DEFAULT 0,
    "rejectedActivities" INTEGER NOT NULL DEFAULT 0,
    "activeCycles" INTEGER NOT NULL DEFAULT 0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalHoursLogged" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastActivityDate" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contributor_reputation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contributor_reputation_userId_key" ON "contributor_reputation"("userId");

-- Security Events
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- Cycle Engagement
CREATE TABLE "cycle_engagement" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "activityCount" INTEGER NOT NULL DEFAULT 0,
    "participationRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "verifiedActivityRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "averageHoursPerUser" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cycle_engagement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cycle_engagement_cycleId_key" ON "cycle_engagement"("cycleId");

-- Agreements
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agreements_version_key" ON "agreements"("version");

-- User Agreements
CREATE TABLE "user_agreements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "user_agreements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_agreements_userId_agreementId_key" ON "user_agreements"("userId", "agreementId");

-- Tasks
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "acceptanceCriteria" TEXT,
    "proofLink" TEXT,
    "securityNote" TEXT,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "starterWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cycleId" TEXT NOT NULL,
    "groupId" TEXT,
    "createdBy" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "maxAssignments" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Task Assignments
CREATE TABLE "task_assignments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "claimedAt" TIMESTAMPTZ,
    "submittedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_assignments_taskId_userId_key" ON "task_assignments"("taskId", "userId");

-- Participation Leave
CREATE TABLE "participation_leave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "leaveStart" TIMESTAMP(3),
    "leaveEnd" TIMESTAMP(3),
    "reason" TEXT,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "participation_leave_pkey" PRIMARY KEY ("id")
);

-- Access Grants
CREATE TABLE "access_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- Admin Action Logs
CREATE TABLE "admin_action_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserIds" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- Revoked Tokens
CREATE TABLE "revoked_tokens" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "revoked_tokens_jti_key" ON "revoked_tokens"("jti");
CREATE INDEX "revoked_tokens_jti_idx" ON "revoked_tokens"("jti");
CREATE INDEX "revoked_tokens_expiresAt_idx" ON "revoked_tokens"("expiresAt");

-- Doc Folders
CREATE TABLE "doc_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_folders_pkey" PRIMARY KEY ("id")
);

-- Documents
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "securityLabel" TEXT NOT NULL DEFAULT 'internal',
    "folderId" TEXT,
    "createdBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Document Access
CREATE TABLE "document_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "accessType" TEXT NOT NULL DEFAULT 'view',
    "expiresAt" TIMESTAMP(3),
    "grantedBy" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_access_pkey" PRIMARY KEY ("id")
);

-- Document Versions
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "versionNumber" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- Document Activity
CREATE TABLE "document_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "document_activity_pkey" PRIMARY KEY ("id")
);

-- Triage Submissions
CREATE TABLE "triage_submissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "proofLinks" TEXT,
    "availability" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "triage_submissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "triage_submissions_email_pending_unique" ON "triage_submissions"("email") WHERE "status" = 'PENDING';
CREATE INDEX "triage_submissions_status_idx" ON "triage_submissions"("status");
CREATE INDEX "triage_submissions_email_idx" ON "triage_submissions"("email");

-- Ideas
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "cycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ideas_submittedBy_idx" ON "ideas"("submittedBy");
CREATE INDEX "ideas_status_idx" ON "ideas"("status");

-- Contribution Scores
CREATE TABLE "contribution_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contribution_scores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contribution_scores_userId_cycleId_key" ON "contribution_scores"("userId", "cycleId");

-- System Pool
CREATE TABLE "system_pool" (
    "id" TEXT NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "contributorPoolPct" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "founderPoolPct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "investorPoolPct" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "decayRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_pool_pkey" PRIMARY KEY ("id")
);

-- ── Foreign Keys ──────────────────────────────────────────────────────────────

ALTER TABLE "users" ADD CONSTRAINT "users_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_participation" ADD CONSTRAINT "cycle_participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_participation" ADD CONSTRAINT "cycle_participation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_feedbackAuthor_fkey" FOREIGN KEY ("feedbackAuthor") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ownership_ledger" ADD CONSTRAINT "ownership_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ownership_ledger" ADD CONSTRAINT "ownership_ledger_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "multipliers" ADD CONSTRAINT "multipliers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "multipliers" ADD CONSTRAINT "multipliers_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activity_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_trail" ADD CONSTRAINT "audit_trail_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "archived_activities" ADD CONSTRAINT "archived_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "archived_activities" ADD CONSTRAINT "archived_activities_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_activity_sessions" ADD CONSTRAINT "user_activity_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_messages" ADD CONSTRAINT "cycle_messages_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_messages" ADD CONSTRAINT "cycle_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "cycle_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "cycle_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "message_mentions" ADD CONSTRAINT "message_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contributor_reputation" ADD CONSTRAINT "contributor_reputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_engagement" ADD CONSTRAINT "cycle_engagement_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_agreements" ADD CONSTRAINT "user_agreements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_agreements" ADD CONSTRAINT "user_agreements_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participation_leave" ADD CONSTRAINT "participation_leave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participation_leave" ADD CONSTRAINT "participation_leave_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_folders" ADD CONSTRAINT "doc_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "doc_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "doc_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_activity" ADD CONSTRAINT "document_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_activity" ADD CONSTRAINT "document_activity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contribution_scores" ADD CONSTRAINT "contribution_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contribution_scores" ADD CONSTRAINT "contribution_scores_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Performance Indexes ───────────────────────────────────────────────────────

CREATE INDEX "users_groupId_idx" ON "users"("groupId");
CREATE INDEX "tasks_groupId_idx" ON "tasks"("groupId");
CREATE INDEX "tasks_isStarter_idx" ON "tasks"("isStarter");
CREATE INDEX "activity_events_linkedTaskId_idx" ON "activity_events"("linkedTaskId");
CREATE INDEX "task_assignments_status_idx" ON "task_assignments"("status");
CREATE INDEX "task_assignments_taskId_idx" ON "task_assignments"("taskId");
CREATE INDEX "tasks_maxAssignments_idx" ON "tasks"("maxAssignments");
CREATE INDEX "build_cycles_metricsInit_idx" ON "build_cycles"("metricsInitialized");
