const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join('/data', 'database.sqlite');
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