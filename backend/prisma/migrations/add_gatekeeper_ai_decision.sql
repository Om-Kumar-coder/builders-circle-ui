-- Add aiDecision column to gatekeeper_reviews
-- Stores the AI decision tier at scan time (AUTO_PASS | FLAGGED | AUTO_BLOCK)
-- so it is not re-derived on every enforcement call and is preserved across re-scans.

ALTER TABLE "gatekeeper_reviews"
  ADD COLUMN IF NOT EXISTS "aiDecision" TEXT;
