-- Add editedAt to cycle_messages for message editing
ALTER TABLE cycle_messages ADD COLUMN editedAt DATETIME;

-- True read receipts: track per-user per-message read status
CREATE TABLE message_reads (
    id TEXT PRIMARY KEY,
    messageId TEXT NOT NULL,
    userId TEXT NOT NULL,
    readAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (messageId) REFERENCES cycle_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(messageId, userId)
);

-- Proper mention join table (replaces JSON string approach)
CREATE TABLE message_mentions (
    id TEXT PRIMARY KEY,
    messageId TEXT NOT NULL,
    userId TEXT NOT NULL,
    FOREIGN KEY (messageId) REFERENCES cycle_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(messageId, userId)
);

-- Indexes
CREATE INDEX idx_message_reads_user ON message_reads(userId);
CREATE INDEX idx_message_reads_message ON message_reads(messageId);
CREATE INDEX idx_message_mentions_user ON message_mentions(userId);
CREATE INDEX idx_message_mentions_message ON message_mentions(messageId);
