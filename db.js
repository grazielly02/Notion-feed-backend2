const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),

  // ----------------------------
  // allowed_clients
  // ----------------------------
  saveAllowedClient: async (email) => {
    await pool.query(
      `INSERT INTO allowed_clients (email)
       VALUES ($1)
       ON CONFLICT (email) DO NOTHING`,
      [email.trim()]
    );
  },

  getAllowedClientByEmail: async (email) => {
    const res = await pool.query(
      `SELECT * FROM allowed_clients WHERE email = $1`,
      [email.trim()]
    );
    return res.rows[0];
  },

  // ----------------------------
  // configs
  // ----------------------------
  saveConfig: async (clientId, token, databaseId) => {
    await pool.query(
      `INSERT INTO configs (id, notionToken, databaseId)
       VALUES ($1, $2, $3)
       ON CONFLICT (id)
       DO UPDATE SET notionToken = EXCLUDED.notionToken,
                     databaseId = EXCLUDED.databaseId`,
      [clientId.trim(), token.trim(), databaseId.trim()]
    );
  },

  getConfig: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM configs WHERE id = $1`,
      [clientId.trim()]
    );
    return res.rows[0];
  },

  // ----------------------------
  // access_logs (FUNÇÃO QUE FALTAVA)
  // ----------------------------
  logAccess: async (clientId, action, ip, userAgent, meta = {}) => {
    try {
      await pool.query(
        `INSERT INTO access_logs (clientId, action, ip, user_agent, meta)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          clientId || null,
          action,
          ip || null,
          userAgent || null,
          meta ? JSON.stringify(meta) : "{}"
        ]
      );
    } catch (err) {
      console.error("Erro ao registrar access_log:", err);
    }
  }
};
