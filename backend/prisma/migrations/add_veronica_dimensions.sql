-- Add veronicaDimensions column to GatekeeperReview for structured AI dimension scores
-- Stores JSON object: {intentConfidence, executionCredibility, vpQuality, trustScore, commitmentSignal, inferredCapitalSignal}

ALTER TABLE gatekeeper_reviews ADD COLUMN IF NOT EXISTS "veronicaDimensions" TEXT;
