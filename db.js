const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Usar o diretório /tmp que é gravável no Render
const dataDir = '/tmp';
const dbPath = path.join(dataDir, 'database.sqlite');

// Garantir que a pasta /tmp exista (ela sempre existe, mas só por segurança)
console.log(`Usando banco de dados em: ${dbPath}`);

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS configs (
    clientId TEXT PRIMARY KEY,
    token TEXT NOT NULL,
    databaseId TEXT NOT NULL
  )
`);

module.exports = db;