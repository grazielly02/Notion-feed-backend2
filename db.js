const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {

  query: (text, params) => pool.query(text, params),

  // -----------------------------------------
  // allowed_clients
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
  // configs
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
  // access_logs
  // -----------------------------------------
  logAccess: async (clientId, action, ip = null, userAgent = null, meta = {}) => {
    await pool.query(
  `INSERT INTO access_logs (clientid, action, ip, user_agent, meta)
   VALUES ($1, $2, $3, $4, $5::jsonb)`,
  [
    clientId || null,
    action || null,
    ip || null,
    userAgent || null,
    JSON.stringify(meta || {})
  ]
);

  getAccessByClientId: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM access_logs
       WHERE clientid = $1
       ORDER BY created_at DESC`,
      [clientId]
    );
    return res.rows;
  }
};
