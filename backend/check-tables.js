const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'prisma', 'dev.db'));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(r => r.name).join(', '));
db.close();
