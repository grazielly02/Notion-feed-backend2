const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = '/data';
const dbPath = path.join(dataDir, 'database.sqlite');

// Apenas verifica se o arquivo do banco existe, sem tentar criar /data
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