const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// Cria a tabela se ela não existir
db.prepare(`
  CREATE TABLE IF NOT EXISTS configs (
    clientId TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    databaseId TEXT NOT NULL
  )
`).run();

module.exports = db;