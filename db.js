const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  getConfig: async (clientId) => {
    const res = await pool.query('SELECT * FROM configs WHERE clientId = $1', [clientId]);
    console.log("Resultado da busca por config:", res.rows[0]);  // Adicione este log
    return res.rows[0];
  },

  saveConfig: async (clientId, token, databaseId) => {
    await pool.query(
      `INSERT INTO configs (clientId, token, databaseId)
       VALUES ($1, $2, $3)
       ON CONFLICT (clientId)
       DO UPDATE SET token = EXCLUDED.token, databaseId = EXCLUDED.databaseId`,
      [clientId, token, databaseId]
    );
  },
};