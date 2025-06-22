const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Importante para o Render conseguir conectar ao Supabase
  },
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  getConfig: async (clientId) => {
    const res = await pool.query('SELECT * FROM configs WHERE clientId = $1', [clientId]);
    return res.rows[0];
  },

  saveConfig: async (clientId, token, databaseId) => {
    await pool.query(
      `
      INSERT INTO configs (clientId, token, databaseId)
      VALUES ($1, $2, $3)
      ON CONFLICT (clientId)
      DO UPDATE SET token = EXCLUDED.token, databaseId = EXCLUDED.databaseId
      `,
      [clientId, token, databaseId]
    );
  },
};