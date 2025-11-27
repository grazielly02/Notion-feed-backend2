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

  // Salvar configurações (widget configs) + dono (allowed_clients)
saveConfig: async (clientId, token, databaseId, allowedClientId, allowedClientEmail) => {
  await pool.query(
    `INSERT INTO configs ("clientId", token, "databaseId", allowed_client_id, allowed_client_email)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("clientId")
     DO UPDATE SET 
        token = EXCLUDED.token,
        "databaseId" = EXCLUDED."databaseId",
        allowed_client_id = COALESCE(EXCLUDED.allowed_client_id, configs.allowed_client_id),
        allowed_client_email = COALESCE(EXCLUDED.allowed_client_email, configs.allowed_client_email)`,
    [clientId.trim(), token.trim(), databaseId.trim(), allowedClientId, allowedClientEmail]
  );
},

  // pegar config pelo clientId do widget (ex: Ameliana)
getConfig: async (clientId) => {
  const res = await pool.query(
    `SELECT * FROM configs WHERE "clientId" = $1 LIMIT 1`,
    [clientId.trim()]
  );
  return res.rows[0];
},

// pegar allowed client pelo clientId da tabela allowed_clients
checkAllowedClient: async (clientId) => {
  const res = await pool.query(
    `SELECT * FROM allowed_clients WHERE "clientId" = $1 LIMIT 1`,
    [clientId]
  );
  return res.rows[0];
},

  // Função correta de log — compatível com sua tabela access_logs
logAccess: async (clientId, ip, userAgent, referrer, isValid, extra = {}) => {
  try {
    console.log(">>> LOG ACCESS EXECUTANDO", { clientId, ip });

    await pool.query(
      `INSERT INTO access_logs (clientid, ip, user_agent, referrer, is_valid, extra)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        clientId,
        ip || null,
        userAgent || null,
        referrer || null,
        isValid,
        extra // <- SEM JSON.stringify !!!
      ]
    );

    console.log(">>> SALVOU COM SUCESSO");

  } catch (err) {
    console.error("ERRO AO SALVAR LOG:", err);
  }
}
};
