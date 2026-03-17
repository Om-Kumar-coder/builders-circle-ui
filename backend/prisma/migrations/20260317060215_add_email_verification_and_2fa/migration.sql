-- AlterTable
ALTER TABLE "cycle_messages" ADD COLUMN "editedAt" DATETIME;

-- CreateTable
CREATE TABLE "message_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reads_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "cycle_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "message_mentions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "message_mentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "cycle_messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "message_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'contributor',
    "status" TEXT NOT NULL DEFAULT 'active',
    "bio" TEXT,
    "avatar" TEXT,
    "notificationPrefs" TEXT NOT NULL DEFAULT '{"stallWarnings":true,"activityReminders":true,"cycleUpdates":true}',
    CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_profiles" ("avatar", "bio", "id", "role", "status", "userId") SELECT "avatar", "bio", "id", "role", "status", "userId" FROM "user_profiles";
DROP TABLE "user_profiles";
ALTER TABLE "new_user_profiles" RENAME TO "user_profiles";
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" TEXT,
    "emailVerifyExpiry" DATETIME,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT
);
INSERT INTO "new_users" ("createdAt", "email", "id", "name", "password", "updatedAt") SELECT "createdAt", "email", "id", "name", "password", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "message_reads_messageId_userId_key" ON "message_reads"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_mentions_messageId_userId_key" ON "message_mentions"("messageId", "userId");
