/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const stmts = [
    `ALTER TABLE user_activity_sessions ADD COLUMN ipAddress TEXT`,
    `ALTER TABLE user_activity_sessions ADD COLUMN userAgent TEXT`,
    `CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      eventType TEXT NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      metadata TEXT,
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_userId ON security_events(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_security_events_createdAt ON security_events(createdAt)`,
  ];

  for (const sql of stmts) {
    try {
      await p.$executeRawUnsafe(sql);
      console.log('OK:', sql.slice(0, 60).replace(/\n/g, ' '));
    } catch (e) {
      console.log('SKIP:', e.message.slice(0, 80));
    }
  }
  await p.$disconnect();
  console.log('Migration complete');
}

run().catch(e => { console.error(e); process.exit(1); });
