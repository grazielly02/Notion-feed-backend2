const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho seguro para o banco no Render Free
const dataDir = '/data';

// Verifica se a pasta /data existe, se não existir cria
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS configs (
    clientId TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    databaseId TEXT NOT NULL
  )
`);

module.exports = db;