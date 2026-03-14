-- CreateTable
CREATE TABLE "user_activity_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEnd" DATETIME,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "pageVisited" TEXT NOT NULL,
    "lastHeartbeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_activity_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contribution_weights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contributionType" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "cycle_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "mentions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cycle_messages_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cycle_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contributor_reputation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reputationScore" REAL NOT NULL DEFAULT 0.0,
    "verifiedActivities" INTEGER NOT NULL DEFAULT 0,
    "rejectedActivities" INTEGER NOT NULL DEFAULT 0,
    "activeCycles" INTEGER NOT NULL DEFAULT 0,
    "consistencyScore" REAL NOT NULL DEFAULT 0.0,
    "totalHoursLogged" REAL NOT NULL DEFAULT 0.0,
    "lastActivityDate" DATETIME,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contributor_reputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cycle_engagement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "engagementScore" REAL NOT NULL DEFAULT 0.0,
    "activityCount" INTEGER NOT NULL DEFAULT 0,
    "participationRate" REAL NOT NULL DEFAULT 0.0,
    "verifiedActivityRatio" REAL NOT NULL DEFAULT 0.0,
    "averageHoursPerUser" REAL NOT NULL DEFAULT 0.0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cycle_engagement_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_activity_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "proofLink" TEXT NOT NULL,
    "description" TEXT,
    "hoursLogged" REAL,
    "workSummary" TEXT,
    "taskReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "rejectionReason" TEXT,
    "feedbackComment" TEXT,
    "feedbackAuthor" TEXT,
    "feedbackTimestamp" DATETIME,
    "contributionType" TEXT NOT NULL DEFAULT 'code',
    "contributionWeight" REAL NOT NULL DEFAULT 1.0,
    "calculatedOwnership" REAL NOT NULL DEFAULT 0.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_events_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_events_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "activity_events_feedbackAuthor_fkey" FOREIGN KEY ("feedbackAuthor") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_activity_events" ("activityType", "calculatedOwnership", "contributionType", "contributionWeight", "createdAt", "cycleId", "description", "hoursLogged", "id", "proofLink", "rejectionReason", "status", "taskReference", "updatedAt", "userId", "verifiedAt", "verifiedBy", "workSummary") SELECT "activityType", "calculatedOwnership", "contributionType", "contributionWeight", "createdAt", "cycleId", "description", "hoursLogged", "id", "proofLink", "rejectionReason", "status", "taskReference", "updatedAt", "userId", "verifiedAt", "verifiedBy", "workSummary" FROM "activity_events";
DROP TABLE "activity_events";
ALTER TABLE "new_activity_events" RENAME TO "activity_events";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "contribution_weights_contributionType_key" ON "contribution_weights"("contributionType");

-- CreateIndex
CREATE UNIQUE INDEX "contributor_reputation_userId_key" ON "contributor_reputation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_engagement_cycleId_key" ON "cycle_engagement"("cycleId");
