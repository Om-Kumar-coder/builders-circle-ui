-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordResetExpiry" DATETIME;
ALTER TABLE "users" ADD COLUMN "passwordResetToken" TEXT;
