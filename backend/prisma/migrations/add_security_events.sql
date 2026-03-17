-- Add IP and user agent tracking to sessions
ALTER TABLE user_activity_sessions ADD COLUMN ipAddress TEXT;
ALTER TABLE user_activity_sessions ADD COLUMN userAgent TEXT;

-- Security events table
CREATE TABLE IF NOT EXISTS security_events (
  id          TEXT PRIMARY KEY,
  userId      TEXT NOT NULL,
  eventType   TEXT NOT NULL,
  ipAddress   TEXT,
  userAgent   TEXT,
  metadata    TEXT,
  createdAt   DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_events_userId ON security_events(userId);
CREATE INDEX IF NOT EXISTS idx_security_events_createdAt ON security_events(createdAt);
