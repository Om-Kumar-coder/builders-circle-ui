-- Entry Control Layer — Phase 1 fixes
-- Migration: add_unique_constraints
-- Adds partial unique index on entry_intake(email) where status = 'PENDING'
-- This prevents duplicate pending submissions for the same email

-- Partial unique index: only one PENDING submission per email
CREATE UNIQUE INDEX "entry_intake_email_pending_idx"
    ON "entry_intake"("email")
    WHERE "status" = 'PENDING';
