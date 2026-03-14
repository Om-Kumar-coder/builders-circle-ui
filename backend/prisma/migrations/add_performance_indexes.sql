-- Critical Performance Indexes for Builder's Circle Platform
-- Run this SQL directly on your database for immediate 10-100x query improvements

-- ActivityEvent indexes (most critical - heavily queried)
CREATE INDEX IF NOT EXISTS idx_activity_events_user_cycle ON activity_events(userId, cycleId);
CREATE INDEX IF NOT EXISTS idx_activity_events_status ON activity_events(status);
CREATE INDEX IF NOT EXISTS idx_activity_events_cycle_status ON activity_events(cycleId, status);
CREATE INDEX IF NOT EXISTS idx_activity_events_created ON activity_events(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_created ON activity_events(userId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_status ON activity_events(userId, status);

-- OwnershipLedger indexes (critical for ownership calculations)
CREATE INDEX IF NOT EXISTS idx_ownership_ledger_user_cycle ON ownership_ledger(userId, cycleId);
CREATE INDEX IF NOT EXISTS idx_ownership_ledger_cycle ON ownership_ledger(cycleId);
CREATE INDEX IF NOT EXISTS idx_ownership_ledger_created ON ownership_ledger(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_ledger_event_type ON ownership_ledger(eventType);
CREATE INDEX IF NOT EXISTS idx_ownership_ledger_user_event ON ownership_ledger(userId, eventType);

-- Multiplier indexes (critical for background jobs)
CREATE INDEX IF NOT EXISTS idx_multiplier_user_cycle ON multipliers(userId, cycleId);
CREATE INDEX IF NOT EXISTS idx_multiplier_created ON multipliers(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_multiplier_user_created ON multipliers(userId, createdAt DESC);

-- CycleParticipation indexes (critical for stall evaluator)
CREATE INDEX IF NOT EXISTS idx_cycle_participation_cycle ON cycle_participation(cycleId);
CREATE INDEX IF NOT EXISTS idx_cycle_participation_user ON cycle_participation(userId);
CREATE INDEX IF NOT EXISTS idx_cycle_participation_stall ON cycle_participation(stallStage);
CREATE INDEX IF NOT EXISTS idx_cycle_participation_opted_in ON cycle_participation(optedIn);
CREATE INDEX IF NOT EXISTS idx_cycle_participation_cycle_opted ON cycle_participation(cycleId, optedIn);

-- Notification indexes (critical for dashboard)
CREATE INDEX IF NOT EXISTS idx_notification_user_read ON notifications(userId, read);
CREATE INDEX IF NOT EXISTS idx_notification_created ON notifications(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_notification_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notification_user_created ON notifications(userId, createdAt DESC);

-- CycleMessage indexes (critical for messaging)
CREATE INDEX IF NOT EXISTS idx_cycle_message_cycle ON cycle_messages(cycleId);
CREATE INDEX IF NOT EXISTS idx_cycle_message_author ON cycle_messages(authorId);
CREATE INDEX IF NOT EXISTS idx_cycle_message_created ON cycle_messages(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_cycle_message_cycle_created ON cycle_messages(cycleId, createdAt DESC);

-- Dispute indexes
CREATE INDEX IF NOT EXISTS idx_dispute_user ON disputes(userId);
CREATE INDEX IF NOT EXISTS idx_dispute_activity ON disputes(activityId);
CREATE INDEX IF NOT EXISTS idx_dispute_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_dispute_created ON disputes(createdAt DESC);

-- ArchivedActivity indexes
CREATE INDEX IF NOT EXISTS idx_archived_activity_user_cycle ON archived_activities(userId, cycleId);
CREATE INDEX IF NOT EXISTS idx_archived_activity_cycle ON archived_activities(cycleId);
CREATE INDEX IF NOT EXISTS idx_archived_activity_created ON archived_activities(createdAt DESC);

-- BuildCycle indexes
CREATE INDEX IF NOT EXISTS idx_build_cycle_state ON build_cycles(state);
CREATE INDEX IF NOT EXISTS idx_build_cycle_created ON build_cycles(createdAt DESC);

-- SystemLog indexes
CREATE INDEX IF NOT EXISTS idx_system_log_created ON system_logs(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_system_log_severity ON system_logs(severity);
CREATE INDEX IF NOT EXISTS idx_system_log_user ON system_logs(userId);

-- AuditTrail indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_admin ON audit_trail(adminId);
CREATE INDEX IF NOT EXISTS idx_audit_trail_target ON audit_trail(targetUserId);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp DESC);

-- ContributorReputation indexes
CREATE INDEX IF NOT EXISTS idx_contributor_reputation_score ON contributor_reputation(reputationScore DESC);
CREATE INDEX IF NOT EXISTS idx_contributor_reputation_updated ON contributor_reputation(updatedAt DESC);

-- CycleEngagement indexes
CREATE INDEX IF NOT EXISTS idx_cycle_engagement_score ON cycle_engagement(engagementScore DESC);
CREATE INDEX IF NOT EXISTS idx_cycle_engagement_updated ON cycle_engagement(updatedAt DESC);

-- UserActivitySession indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_session_user ON user_activity_sessions(userId);
CREATE INDEX IF NOT EXISTS idx_user_activity_session_start ON user_activity_sessions(sessionStart DESC);

-- ContributionWeight indexes
CREATE INDEX IF NOT EXISTS idx_contribution_weight_type ON contribution_weights(contributionType);
CREATE INDEX IF NOT EXISTS idx_contribution_weight_updated ON contribution_weights(updatedAt DESC);