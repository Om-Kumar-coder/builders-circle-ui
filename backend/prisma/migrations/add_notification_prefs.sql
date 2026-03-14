-- Add notification preferences to user_profiles
ALTER TABLE "user_profiles" ADD COLUMN "notificationPrefs" TEXT NOT NULL DEFAULT '{"stallWarnings":true,"activityReminders":true,"cycleUpdates":true}';
