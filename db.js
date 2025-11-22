const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  // -----------------------------------------
  // ALLOWED_CLIENTS  (para liberar o acesso)
  // -----------------------------------------
  saveAllowedClient: async (email, clientId) => {
    await pool.query(
      `INSERT INTO allowed_clients (email, "clientId")
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [email.trim(), clientId.trim()]
    );
  },

  getAllowedClientByEmail: async (email) => {
    const res = await pool.query(
      `SELECT * FROM allowed_clients WHERE email = $1`,
      [email.trim()]
    );
    return res.rows[0];
  },

  // -----------------------------------------
  // CONFIGS  (token + databaseId do Notion)
  // -----------------------------------------
  saveConfig: async (clientId, token, databaseId) => {
    await pool.query(
      `INSERT INTO configs ("clientId", token, "databaseId")
       VALUES ($1, $2, $3)
       ON CONFLICT ("clientId")
       DO UPDATE SET token = EXCLUDED.token,
                     "databaseId" = EXCLUDED."databaseId"`,
      [clientId.trim(), token.trim(), databaseId.trim()]
    );
  },

  getConfig: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM configs WHERE "clientId"=$1`,
      [clientId.trim()]
    );
    return res.rows[0];
  },

  // -----------------------------------------
  // ACCESS_LOGS  (monitoramento avançado)
  // -----------------------------------------
  logAccess: async (clientId, action, ip = null, userAgent = null, meta = {}) => {
    await pool.query(
      `INSERT INTO access_logs ("clientId", action, ip, user_agent, meta)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        clientId?.trim() || null,
        action?.trim() || null,
        ip || null,
        userAgent || null,
        meta
      ]
    );
  },

  getAccessByClientId: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM access_logs
       WHERE "clientId" = $1
       ORDER BY created_at DESC`,
      [clientId.trim()]
    );
    return res.rows;
  }
};
