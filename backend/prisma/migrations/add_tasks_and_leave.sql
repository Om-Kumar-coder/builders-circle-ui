-- Tasks table
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "cycleId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "dueDate" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tasks_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tasks_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Task assignments table
CREATE TABLE IF NOT EXISTS "task_assignments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "task_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "task_assignments_taskId_userId_key" ON "task_assignments"("taskId", "userId");

-- Participation leave table
CREATE TABLE IF NOT EXISTS "participation_leave" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "leaveStart" DATETIME,
  "leaveEnd" DATETIME,
  "reason" TEXT,
  "grantedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "participation_leave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "participation_leave_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
