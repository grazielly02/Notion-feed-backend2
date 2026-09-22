const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// =====================================================
// CRIPTOGRAFIA DOS TOKENS DO NOTION
// =====================================================

function getEncryptionKey() {
  const key = process.env.CONFIG_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "CONFIG_ENCRYPTION_KEY não configurada no ambiente."
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "CONFIG_ENCRYPTION_KEY deve conter exatamente 64 caracteres hexadecimais."
    );
  }

  return Buffer.from(key, "hex");
}

function encryptToken(token) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "enc:v1",
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex")
  ].join(":");
}

function decryptToken(value) {
  if (!value) {
    return value;
  }

const parts = value.split(":");

if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
  throw new Error("Token criptografado possui formato inválido.");
}

  if (parts.length !== 5) {
    throw new Error("Token criptografado possui formato inválido.");
  }

  const [, , ivHex, authTagHex, encryptedHex] = parts;

  const key = getEncryptionKey();

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

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

  getAllowedClientByClientId: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM allowed_clients WHERE "clientId"=$1`,
      [clientId.trim()]
    );

    return res.rows[0] || null;
  },

  saveConfig: async (
    widgetId,
    token,
    databaseId,
    licenseId,
    projectName,
    email
  ) => {
    const encryptedToken = encryptToken(token.trim());

    await pool.query(
      `INSERT INTO configs ("clientId", token, "databaseId", "licenseId", projectname, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("clientId")
       DO UPDATE SET
         token = EXCLUDED.token,
         "databaseId" = EXCLUDED."databaseId",
         "licenseId" = EXCLUDED."licenseId",
         projectname = EXCLUDED.projectname,
         email = EXCLUDED.email`,
      [
        widgetId.trim(),
        encryptedToken,
        databaseId.trim(),
        licenseId.trim(),
        projectName.trim(),
        email ? email.trim() : null
      ]
    );
  },

  getConfig: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM configs WHERE "clientId"=$1`,
      [clientId.trim()]
    );

    const config = res.rows[0];

    if (!config) {
      return config;
    }

    // Descriptografa o token antes de devolvê-lo ao restante do backend.
    if (config.token) {
      config.token = decryptToken(config.token);
    }

    return config;
  },

  // Função correta de log — compatível com sua tabela access_logs
  logAccess: async (
    clientId,
    ip,
    userAgent,
    referrer,
    isValid,
    extra = {}
  ) => {
    try {
      console.log(">>> LOG ACCESS EXECUTANDO", { clientId, ip });

      const realClientId = extra.realClientId || null;

      await pool.query(
        `INSERT INTO access_logs
         (clientid, "realClientId", ip, user_agent, referrer, is_valid, extra)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          clientId,
          realClientId,
          ip || null,
          userAgent || null,
          referrer || null,
          isValid,
          extra
        ]
      );

      console.log(">>> SALVOU COM SUCESSO");

    } catch (err) {
      console.error("ERRO AO SALVAR LOG:", err);
    }
  }
};
