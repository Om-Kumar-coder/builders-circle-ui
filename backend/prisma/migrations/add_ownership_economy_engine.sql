-- Additive migration: Ownership Economy Engine
-- Safe to run on existing production data — no existing columns/tables are modified or dropped.

-- 1. Add scoreContribution to activity_events (nullable)
ALTER TABLE "activity_events"
  ADD COLUMN IF NOT EXISTS "scoreContribution" DOUBLE PRECISION;

-- 2. Add normalizedOwnershipPct to ownership_ledger (nullable)
ALTER TABLE "ownership_ledger"
  ADD COLUMN IF NOT EXISTS "normalizedOwnershipPct" DOUBLE PRECISION;

-- 3. Create contribution_scores table
CREATE TABLE IF NOT EXISTS "contribution_scores" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "cycleId"       TEXT NOT NULL,
  "score"         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contribution_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contribution_scores_userId_cycleId_key" UNIQUE ("userId", "cycleId"),
  CONSTRAINT "contribution_scores_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "users"("id")        ON DELETE CASCADE,
  CONSTRAINT "contribution_scores_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "build_cycles"("id") ON DELETE CASCADE
);

-- 4. Create system_pool table
CREATE TABLE IF NOT EXISTS "system_pool" (
  "id"                 TEXT NOT NULL,
  "totalValue"         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "contributorPoolPct" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
  "founderPoolPct"     DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "investorPoolPct"    DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  "decayRate"          DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_pool_pkey" PRIMARY KEY ("id")
);

-- 5. Seed a default system pool row if none exists
INSERT INTO "system_pool" ("id", "totalValue", "contributorPoolPct", "founderPoolPct", "investorPoolPct", "decayRate", "isActive", "updatedAt", "createdAt")
SELECT gen_random_uuid()::text, 0.0, 0.4, 0.5, 0.1, 0.01, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "system_pool");
