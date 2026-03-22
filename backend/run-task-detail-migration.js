const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./prisma/dev.db');

const cols = [
  "ALTER TABLE tasks ADD COLUMN acceptanceCriteria TEXT",
  "ALTER TABLE tasks ADD COLUMN proofLink TEXT",
  "ALTER TABLE tasks ADD COLUMN securityNote TEXT",
  "ALTER TABLE tasks ADD COLUMN restricted INTEGER NOT NULL DEFAULT 0",
];

for (const sql of cols) {
  try {
    db.exec(sql);
    console.log('OK:', sql.split(' ').slice(4, 7).join(' '));
  } catch (e) {
    if (e.message.includes('duplicate column')) {
      console.log('Already exists, skipping:', sql.split(' ')[5]);
    } else {
      console.error('Error:', e.message);
    }
  }
}

db.close();
console.log('Migration complete.');
