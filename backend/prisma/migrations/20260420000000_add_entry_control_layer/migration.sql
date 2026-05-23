-- Entry Control Layer — Phase 1
-- Migration: add_entry_control_layer
-- Adds: entry_intake table, event_logs table, with indexes

CREATE TABLE "entry_intake" (
    "id"                   TEXT NOT NULL,
    "fullName"             TEXT NOT NULL,
    "email"                TEXT NOT NULL,
    "phoneOrWhatsapp"      TEXT,
    "countryTimezone"      TEXT,
    "intentType"           TEXT NOT NULL,
    "capitalRange"         TEXT,
    "executionProofUrl"    TEXT,
    "executionOutcome"     TEXT,
    "executionRecency"     TEXT,
    "valueProposition"     TEXT NOT NULL,
    "availability"         TEXT,
    "timeline"             TEXT,
    "intentOutcome30_60"   TEXT,
    "prefilterAck"         BOOLEAN NOT NULL DEFAULT false,
    "prefilterSessionId"   TEXT,
    "status"               TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entry_intake_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_logs" (
    "id"        TEXT NOT NULL,
    "event"     TEXT NOT NULL,
    "sessionId" TEXT,
    "metadata"  TEXT,
    "userId"    TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "entry_intake_email_idx" ON "entry_intake"("email");
CREATE INDEX "entry_intake_status_idx" ON "entry_intake"("status");
CREATE INDEX "entry_intake_createdAt_idx" ON "entry_intake"("createdAt");
CREATE INDEX "event_logs_event_idx" ON "event_logs"("event");
CREATE INDEX "event_logs_sessionId_idx" ON "event_logs"("sessionId");
CREATE INDEX "event_logs_createdAt_idx" ON "event_logs"("createdAt");
