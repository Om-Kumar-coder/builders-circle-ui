-- Add onboardingTourCompleted field to users table
ALTER TABLE "users" ADD COLUMN "onboardingTourCompleted" BOOLEAN NOT NULL DEFAULT false;
