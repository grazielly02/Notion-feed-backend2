const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = '/data';

// Verifica se a pasta /data existe, senão cria
try {
  if (!fs.existsSync(dataDir)) {
    console.log('Pasta /data não existe. Criando...');
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.error('Erro ao tentar criar /data:', err);
}

const dbPath = path.join(dataDir, 'database.sqlite');
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