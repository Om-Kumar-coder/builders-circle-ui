-- Veronica Gatekeeper System
-- Migration: add_gatekeeper_veronica

CREATE TABLE "gatekeeper_reviews" (
    "id"            TEXT NOT NULL,
    "entityType"    TEXT NOT NULL,
    "entityId"      TEXT NOT NULL,
    "queue"         TEXT NOT NULL DEFAULT 'new_users',
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "veronicaScore" DOUBLE PRECISION,
    "veronicaFlags" TEXT,
    "veronicaNotes" TEXT,
    "reviewedBy"    TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gatekeeper_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_reports" (
    "id"                   TEXT NOT NULL,
    "reportDate"           TIMESTAMP(3) NOT NULL,
    "newSignups"           INTEGER NOT NULL DEFAULT 0,
    "approvedUsers"        INTEGER NOT NULL DEFAULT 0,
    "rejectedUsers"        INTEGER NOT NULL DEFAULT 0,
    "totalSubmissions"     INTEGER NOT NULL DEFAULT 0,
    "approvedSubmissions"  INTEGER NOT NULL DEFAULT 0,
    "rejectedSubmissions"  INTEGER NOT NULL DEFAULT 0,
    "pendingSubmissions"   INTEGER NOT NULL DEFAULT 0,
    "activeContributors"   INTEGER NOT NULL DEFAULT 0,
    "inactiveContributors" INTEGER NOT NULL DEFAULT 0,
    "openCycles"           INTEGER NOT NULL DEFAULT 0,
    "pendingReviews"       INTEGER NOT NULL DEFAULT 0,
    "flaggedItems"         INTEGER NOT NULL DEFAULT 0,
    "metadata"             TEXT,
    "generatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_reports_reportDate_key" ON "daily_reports"("reportDate");
CREATE INDEX "gatekeeper_reviews_entityType_entityId_idx" ON "gatekeeper_reviews"("entityType", "entityId");
CREATE INDEX "gatekeeper_reviews_queue_status_idx" ON "gatekeeper_reviews"("queue", "status");
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");
