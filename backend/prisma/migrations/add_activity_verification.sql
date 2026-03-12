-- Migration to add activity verification fields
-- This updates the ActivityEvent model to support the new verification system

-- Add new columns to activity_events table
ALTER TABLE activity_events ADD COLUMN hoursLogged REAL;
ALTER TABLE activity_events ADD COLUMN workSummary TEXT;
ALTER TABLE activity_events ADD COLUMN taskReference TEXT;
ALTER TABLE activity_events ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE activity_events ADD COLUMN verifiedBy TEXT;
ALTER TABLE activity_events ADD COLUMN verifiedAt DATETIME;
ALTER TABLE activity_events ADD COLUMN rejectionReason TEXT;
ALTER TABLE activity_events ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to use new status field
UPDATE activity_events SET status = verified WHERE verified IS NOT NULL;

-- Add foreign key constraint for verifiedBy
-- Note: This assumes the users table exists and has an id column
-- ALTER TABLE activity_events ADD CONSTRAINT fk_activity_verifier 
--   FOREIGN KEY (verifiedBy) REFERENCES users(id);

-- Update contribution types to include new types
-- This is handled by the application validation, but we can add a check constraint if needed
-- ALTER TABLE activity_events ADD CONSTRAINT chk_contribution_type 
--   CHECK (contributionType IN ('code', 'documentation', 'review', 'hours_logged', 'meeting', 'research', 'task_completion'));

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_activity_status ON activity_events(status);
CREATE INDEX IF NOT EXISTS idx_activity_verified_by ON activity_events(verifiedBy);
CREATE INDEX IF NOT EXISTS idx_activity_verified_at ON activity_events(verifiedAt);

-- Update ownership ledger event types
UPDATE ownership_ledger SET eventType = 'contribution_approved' WHERE eventType = 'activity_verified';