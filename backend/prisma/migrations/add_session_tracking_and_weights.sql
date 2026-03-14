-- Add UserActivitySession table
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

-- Add ContributionWeight table
CREATE TABLE "contribution_weights" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contributionType" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index on contributionType
CREATE UNIQUE INDEX "contribution_weights_contributionType_key" ON "contribution_weights"("contributionType");

-- Insert default weights
INSERT INTO "contribution_weights" ("id", "contributionType", "weight", "description", "createdAt", "updatedAt") VALUES
('clw1', 'code', 1.0, 'Default weight for code contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('clw2', 'documentation', 0.6, 'Default weight for documentation contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('clw3', 'review', 0.5, 'Default weight for review contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('clw4', 'hours_logged', 0.4, 'Default weight for hours_logged contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('clw5', 'research', 0.5, 'Default weight for research contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('clw6', 'meeting', 0.2, 'Default weight for meeting contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('clw7', 'task_completion', 0.8, 'Default weight for task_completion contributions', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);