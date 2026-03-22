-- Add task detail fields: acceptanceCriteria, proofLink, securityNote, restricted
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "acceptanceCriteria" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "proofLink" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "securityNote" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "restricted" BOOLEAN NOT NULL DEFAULT false;
