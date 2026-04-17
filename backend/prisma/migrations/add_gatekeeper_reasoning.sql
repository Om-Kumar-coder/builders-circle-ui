-- Add reasoning column to gatekeeper_reviews
-- Stores the full AI reasoning text for inspection when a submission fails or is flagged.
ALTER TABLE "gatekeeper_reviews"
  ADD COLUMN IF NOT EXISTS "reasoning" TEXT;
