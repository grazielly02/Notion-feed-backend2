const { Pool } = require("pg");
require("dotenv").config();

console.log("🔐 Iniciando diagnóstico da migração...");

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não está disponível.");
  process.exit(1);
}

if (!process.env.CONFIG_ENCRYPTION_KEY) {
  console.error("❌ CONFIG_ENCRYPTION_KEY não está disponível.");
  process.exit(1);
}

console.log("✔️ DATABASE_URL encontrada.");
console.log("✔️ CONFIG_ENCRYPTION_KEY encontrada.");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function testDatabase() {
  try {
    console.log("🔌 Testando conexão com PostgreSQL...");

    const connection = await pool.query("SELECT NOW()");

    console.log(
      "✔️ Conexão com PostgreSQL funcionando:",
      connection.rows[0].now
    );

    console.log("🔎 Consultando tabela configs...");

    const result = await pool.query(`
      SELECT
        "clientId",
        token
      FROM configs
      WHERE token IS NOT NULL
    `);

    console.log(
      `✔️ Consulta realizada. Registros encontrados: ${result.rows.length}`
    );

    let encrypted = 0;
    let plaintext = 0;

    for (const row of result.rows) {
      if (row.token.startsWith("enc:v1:")) {
        encrypted++;
      } else {
        plaintext++;
      }
    }

    console.log(`🔐 Já criptografados: ${encrypted}`);
    console.log(`⚠️ Ainda em texto puro: ${plaintext}`);

    console.log("✅ Diagnóstico concluído.");
  } catch (error) {
    console.error("❌ ERRO NO DIAGNÓSTICO:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
    console.log("🔌 Conexão encerrada.");
  }
}

testDatabase();
