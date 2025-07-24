const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  getConfig: async (clientId) => {
    const trimmedClientId = clientId.trim();
    const res = await pool.query(
      'SELECT * FROM configs WHERE "clientId" = $1',
      [trimmedClientId]
    );
    console.log("Resultado da busca por config:", res.rows[0]);
    return res.rows[0];
  },

  saveConfig: async (clientId, token, databaseId) => {
    const trimmedClientId = clientId.trim();
    const trimmedToken = token.trim();
    const trimmedDatabaseId = databaseId.trim();

    await pool.query(
      `INSERT INTO configs ("clientId", token, "databaseId")
       VALUES ($1, $2, $3)
       ON CONFLICT ("clientId")
       DO UPDATE SET token = EXCLUDED.token, "databaseId" = EXCLUDED."databaseId"`,
      [trimmedClientId, trimmedToken, trimmedDatabaseId]
    );
  },
};
