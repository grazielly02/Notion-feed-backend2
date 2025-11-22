// index.js (COMPLETO E ATUALIZADO)
import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://meu-widget-feed.netlify.app", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// ---------------------------------------------------
// Criar tabelas
// ---------------------------------------------------

async function ensureConfigsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS configs (
        id TEXT PRIMARY KEY,
        notionToken TEXT,
        databaseId TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✔ Tabela configs OK");
  } catch (err) {
    console.error("Erro ao criar tabela configs:", err);
  }
}

async function ensureAllowedClientsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS allowed_clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✔ Tabela allowed_clients OK");
  } catch (err) {
    console.error("Erro ao criar tabela allowed_clients:", err);
  }
}

// 🔵 A tabela que faltava!
async function ensureAccessLogsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        clientId TEXT,
        action TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✔ Tabela access_logs OK");
  } catch (err) {
    console.error("Erro ao criar tabela access_logs:", err);
  }
}

// Executa as 3 verificações
ensureConfigsTable();
ensureAllowedClientsTable();
ensureAccessLogsTable();

// ---------------------------------------------------
// Função para capturar IP real
// ---------------------------------------------------
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ---------------------------------------------------
// Rota: Gerar link exclusivo
// ---------------------------------------------------
app.post("/generate-client", async (req, res) => {
  try {
    const { email } = req.body;
    const ip = getIP(req);
    const ua = req.headers["user-agent"] || "unknown";

    if (!email) {
      await db.logAccess(null, "generate_client_missing_email", ip, ua);
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    // Verifica se está na lista permitida
    const allowed = await db.query(
      `SELECT * FROM allowed_clients WHERE email = $1`,
      [email]
    );

    if (allowed.rowCount === 0) {
      await db.logAccess(null, "generate_client_not_allowed", ip, ua, { email });
      return res.status(403).json({ error: "Email não autorizado" });
    }

    // Verifica se já existe config
    const existingConfig = await db.query(
      `SELECT id FROM configs WHERE id = $1`,
      [email]
    );

    if (existingConfig.rowCount > 0) {
      await db.logAccess(email, "generate_client_existing", ip, ua);
      return res.json({
        clientId: email,
        url: `https://meu-widget-feed.netlify.app/widget.html?clientId=${email}`,
      });
    }

    // Criar novo config vazio
    await db.query(
      `INSERT INTO configs (id, notionToken, databaseId) VALUES ($1, '', '')`,
      [email]
    );

    await db.logAccess(email, "generate_client_new", ip, ua);

    return res.json({
      clientId: email,
      url: `https://meu-widget-feed.netlify.app/widget.html?clientId=${email}`,
    });
  } catch (err) {
    console.error("Erro generate-client:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---------------------------------------------------
// Rota: Salvar config do cliente
// ---------------------------------------------------
app.post("/save-config", async (req, res) => {
  try {
    const { clientId, notionToken, databaseId } = req.body;
    const ip = getIP(req);
    const ua = req.headers["user-agent"] || "unknown";

    if (!clientId) {
      await db.logAccess(null, "save_config_missing_client", ip, ua);
      return res.status(400).json({ error: "clientId é obrigatório" });
    }

    await db.query(
      `UPDATE configs SET notionToken = $1, databaseId = $2 WHERE id = $3`,
      [notionToken, databaseId, clientId]
    );

    await db.logAccess(clientId, "save_config_success", ip, ua);

    return res.json({ success: true });
  } catch (err) {
    console.error("Erro save-config:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---------------------------------------------------
// Rota: Fornecer dados de posts ao widget
// ---------------------------------------------------
app.get("/posts", async (req, res) => {
  try {
    const { clientId } = req.query;
    const ip = getIP(req);
    const ua = req.headers["user-agent"] || "unknown";

    if (!clientId) {
      await db.logAccess(null, "posts_missing_client", ip, ua);
      return res.status(400).json({ error: "clientId é obrigatório" });
    }

    await db.logAccess(clientId, "posts_requested", ip, ua);

    // Recupera as configs
    const config = await db.query(`SELECT * FROM configs WHERE id = $1`, [
      clientId,
    ]);

    if (config.rowCount === 0) {
      await db.logAccess(clientId, "posts_no_config", ip, ua);
      return res.status(404).json({ error: "Configuração não encontrada" });
    }

    // --- AQUI você chama a API do Notion depois ---
    // Por enquanto simulação:
    const samplePosts = [
      { id: "1", type: "image", url: "https://picsum.photos/300" },
      { id: "2", type: "image", url: "https://picsum.photos/301" }
    ];

    return res.json({ posts: samplePosts });

  } catch (err) {
    console.error("Erro posts:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---------------------------------------------------
// Rota do widget (registro de acesso)
// ---------------------------------------------------
app.get("/widget", async (req, res) => {
  const { clientId } = req.query;
  const ip = getIP(req);
  const ua = req.headers["user-agent"] || "unknown";

  await db.logAccess(clientId, "widget_view", ip, ua);

  res.json({ ok: true });
});

// ---------------------------------------------------
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
