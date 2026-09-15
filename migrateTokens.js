const crypto = require("crypto");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getEncryptionKey() {
  const key = process.env.CONFIG_ENCRYPTION_KEY;

  if (!key) {
    throw new Error("CONFIG_ENCRYPTION_KEY não configurada.");
  }

  const buffer = Buffer.from(key, "hex");

  if (buffer.length !== 32) {
    throw new Error(
      "CONFIG_ENCRYPTION_KEY deve conter exatamente 32 bytes em hexadecimal."
    );
  }

  return buffer;
}

function encryptToken(token) {
  if (!token) {
    return token;
  }

  // Se já estiver criptografado, não criptografa novamente.
  if (token.startsWith("enc:v1:")) {
    return token;
  }

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
    "enc",
    "v1",
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex")
  ].join(":");
}

async function migrateTokens() {
  try {
    console.log("🔐 Iniciando migração dos tokens...");

    const result = await pool.query(`
      SELECT "clientId", token
      FROM configs
      WHERE token IS NOT NULL
    `);

    console.log(`📦 Configurações encontradas: ${result.rows.length}`);

    let migrated = 0;
    let alreadyEncrypted = 0;

    for (const row of result.rows) {
      if (!row.token) {
        continue;
      }

      if (row.token.startsWith("enc:v1:")) {
        alreadyEncrypted++;
        continue;
      }

      const encryptedToken = encryptToken(row.token);

      await pool.query(
        `UPDATE configs
         SET token = $1
         WHERE "clientId" = $2`,
        [encryptedToken, row.clientId]
      );

      migrated++;

      console.log(
        `✔️ Token migrado: widgetId=${row.clientId}`
      );
    }

    console.log("");
    console.log("=================================");
    console.log("✅ MIGRAÇÃO CONCLUÍDA");
    console.log("=================================");
    console.log(`Migrados: ${migrated}`);
    console.log(`Já criptografados: ${alreadyEncrypted}`);
    console.log(`Total analisado: ${result.rows.length}`);
    console.log("=================================");

  } catch (error) {
    console.error("❌ Erro durante a migração:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrateTokens();
