-- Add feedback fields to activity_events
ALTER TABLE activity_events ADD COLUMN feedbackComment TEXT;
ALTER TABLE activity_events ADD COLUMN feedbackAuthor TEXT;
ALTER TABLE activity_events ADD COLUMN feedbackTimestamp DATETIME;

-- Create cycle_messages table
CREATE TABLE cycle_messages (
    id TEXT PRIMARY KEY,
    cycleId TEXT NOT NULL,
    authorId TEXT NOT NULL,
    message TEXT NOT NULL,
    mentions TEXT NOT NULL DEFAULT '[]', -- JSON array of user IDs
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cycleId) REFERENCES build_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
);

-- Create contributor_reputation table
CREATE TABLE contributor_reputation (
    id TEXT PRIMARY KEY,
    userId TEXT UNIQUE NOT NULL,
    reputationScore REAL NOT NULL DEFAULT 0.0,
    verifiedActivities INTEGER NOT NULL DEFAULT 0,
    rejectedActivities INTEGER NOT NULL DEFAULT 0,
    activeCycles INTEGER NOT NULL DEFAULT 0,
    consistencyScore REAL NOT NULL DEFAULT 0.0,
    totalHoursLogged REAL NOT NULL DEFAULT 0.0,
    lastActivityDate DATETIME,
    calculatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- Create cycle_engagement table
CREATE TABLE cycle_engagement (
    id TEXT PRIMARY KEY,
    cycleId TEXT UNIQUE NOT NULL,
    engagementScore REAL NOT NULL DEFAULT 0.0,
    activityCount INTEGER NOT NULL DEFAULT 0,
    participationRate REAL NOT NULL DEFAULT 0.0,
    verifiedActivityRatio REAL NOT NULL DEFAULT 0.0,
    averageHoursPerUser REAL NOT NULL DEFAULT 0.0,
    messageCount INTEGER NOT NULL DEFAULT 0,
    calculatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cycleId) REFERENCES build_cycles(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_cycle_messages_cycle ON cycle_messages(cycleId);
CREATE INDEX idx_cycle_messages_author ON cycle_messages(authorId);
CREATE INDEX idx_cycle_messages_created ON cycle_messages(createdAt);
CREATE INDEX idx_contributor_reputation_user ON contributor_reputation(userId);
CREATE INDEX idx_contributor_reputation_score ON contributor_reputation(reputationScore DESC);
CREATE INDEX idx_cycle_engagement_cycle ON cycle_engagement(cycleId);
CREATE INDEX idx_cycle_engagement_score ON cycle_engagement(engagementScore DESC);