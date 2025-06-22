const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function createConfigsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configs (
        clientId TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        databaseId TEXT NOT NULL
      );
    `);
    console.log("✅ Tabela 'configs' criada com sucesso.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao criar tabela configs:", error);
    process.exit(1);
  }
}

createConfigsTable();