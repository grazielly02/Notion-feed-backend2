const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),

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
      `SELECT * FROM allowed_clients WHERE email=$1`,
      [email.trim()]
    );
    return res.rows[0];
  },

  saveConfig: async (clientId, token, databaseId) => {
    await pool.query(
      `INSERT INTO configs ("clientId", token, "databaseId")
       VALUES ($1, $2, $3)
       ON CONFLICT ("clientId")
       DO UPDATE SET token = EXCLUDED.token, "databaseId" = EXCLUDED."databaseId"`,
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

  // Função correta de log — compatível com sua tabela access_logs
logAccess: async (clientId, action, ip, userAgent, referrer = null, extra = {}) => {
  await pool.query(
    `INSERT INTO access_logs (clientId, action, ip, user_agent, referrer, extra)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      clientId,
      action,
      ip,
      userAgent,
      referrer,
      extra
    ]
  );
},
