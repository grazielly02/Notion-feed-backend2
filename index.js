const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();
const db = require("./db");

// Função para gerar clientId aleatório
function generateRandomId(length = 8) {
  return crypto.randomBytes(length)
    .toString("base64url")
    .slice(0, length);
}

// Garantir tabela configs
async function ensureConfigsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS configs (
        clientId TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        databaseId TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMP DEFAULT now(),
        licenseId TEXT,
        projectname TEXT
      );
    `);

    console.log("✔️ Tabela 'configs' verificada/criada.");
  } catch (error) {
    console.error("❌ Erro ao criar/verificar tabela configs:", error);
  }
  }

// Garantir tabela allowed_clients
async function ensureAllowedClientsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS allowed_clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        clientId TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT now()
      );
    `);
    console.log("✔️ Tabela 'allowed_clients' verificada/criada.");
  } catch (error) {
    console.error("❌ Erro ao criar/verificar tabela allowed_clients:", error);
  }
}

ensureConfigsTable();
ensureAllowedClientsTable();

const app = express();

const allowedOrigins = [
  "https://meu-widget-feed.netlify.app"
];

app.use(cors({
  origin: allowedOrigins
}));

const rateLimitStore = new Map();

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now - record.start >= windowMs) {
      record = {
        start: now,
        count: 0
      };
    }

    record.count += 1;
    rateLimitStore.set(key, record);

    if (record.count > max) {
      return res.status(429).json({
        success: false,
        error: "Muitas tentativas. Aguarde alguns minutos e tente novamente."
      });
    }

    next();
  };
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Extrair databaseId do link do Notion
function extractDatabaseId(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  const normalized = input.trim().replace(/-/g, "");

  const match = normalized.match(/[a-f0-9]{32}/i);

  if (!match) {
    return null;
  }

  return match[0].toLowerCase();
}

// Consultar Notion
async function queryDatabase(token, databaseId) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  try {
    const response = await axios.post(url, {}, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      }
    });
    return response.data.results;
  } catch (error) {
    console.error("❌ Erro ao consultar Notion:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao consultar Notion");
  }
}

// ROTA — validar cliente e liberar configuração
app.post(
  "/generate-client",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10
  }),
  async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Informe seu e-mail"
    });
  }

  try {
    // Buscar cliente previamente autorizado
    const client = await db.getAllowedClientByEmail(email);

    // Se o e-mail não estiver cadastrado, não liberar acesso
    if (!client) {
      return res.status(403).json({
        success: false,
        error: "E-mail não encontrado. Verifique se está usando o mesmo e-mail informado na compra."
      });
    }

    return res.json({
      success: true,
      clientId: client.clientId,
      setupUrl: `https://meu-widget-feed.netlify.app/form.html?clientId=${client.clientId}`
    });

  } catch (error) {
    console.error("❌ Erro ao validar cliente:", error.message);

    return res.status(500).json({
      success: false,
      error: "Não foi possível validar o acesso. Tente novamente."
    });
  }
});

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Página do formulário
app.get("/config", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// Salvar token/databaseId
app.post("/save-config", async (req, res) => {
  const { clientId, realClientId, token, databaseId } = req.body;

  // clientId do form = nome do projeto
  const projectName = clientId;

  if (!clientId || !realClientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const cleanDatabaseId = extractDatabaseId(databaseId);

  if (!cleanDatabaseId) {
    return res.status(400).send("Database ID inválido.");
  }

  try {
    // realClientId = clientId da licença
    const licenseId = realClientId.trim();

    // Verificar se a licença pertence a um comprador autorizado
    const buyer = await db.getAllowedClientByClientId(licenseId);

    if (!buyer) {
      console.warn(
        `⚠️ Tentativa de configuração com licença inválida: ${licenseId}`
      );

      return res.status(403).send(
        "Licença não autorizada. Verifique seu acesso antes de configurar o widget."
      );
    }

    const email = buyer.email;

    // gera widgetId novo
    const widgetId = generateRandomId(8);

    await db.saveConfig(
      widgetId,
      token,
      cleanDatabaseId,
      licenseId,
      projectName,
      email
    );

    console.log(
      `✔️ Configuração salva: widgetId=${widgetId} | licenseId=${licenseId} | email=${email}`
    );

    const finalUrl =
      `https://meu-widget-feed.netlify.app/previsualizacao.html?clientId=${encodeURIComponent(widgetId)}`;

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Redirecionando...</title>
        <style>
          body { font-family: sans-serif; text-align: center; margin-top: 50px; }
        </style>
      </head>
      <body>
        <p>Redirecionando para seu widget...</p>
        <script>
          window.location.href = "${finalUrl}";
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("❌ Erro ao salvar:", error.message);
    res.status(500).send("Erro ao salvar configuração.");
  }
});

// ROTA: Recebe logs do widget e registra no DB
app.post(
  "/track-access",
  rateLimit({
    windowMs: 60 * 1000,
    max: 30
  }),
  async (req, res) => {
  try {
    const { clientId, referrer } = req.body || {};
    if (!clientId) return res.status(400).json({ error: "clientId missing" });

    const rawIp = (req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress ||
        "").split(",")[0].trim();

    const ip = rawIp || null;
    const userAgent = req.headers["user-agent"] || null;

    // busca config pelo widgetId
const config = await db.getConfig(clientId);

let licenseId = null;

if (config) {
  licenseId =
    config.licenseid ||
    config.licenseId ||
    config.clientid ||
    config.clientId ||
    null;
}

// valida pelo licenseId
let isValid = false;

if (licenseId) {
  const check = await db.query(
    `SELECT 1 FROM allowed_clients WHERE "clientId" = $1 LIMIT 1`,
    [licenseId]
  );
  isValid = check.rows.length > 0;
    }

    await db.logAccess(clientId, ip, userAgent, referrer, isValid, {
      forwarded_for: req.headers["x-forwarded-for"] || null
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("track-access error:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// Buscar posts + registrar acesso
app.get(
  "/widget/:clientId/posts",
  rateLimit({
    windowMs: 60 * 1000,
    max: 60
  }),
  async (req, res) => {
  const clientId = req.params.clientId;

const rawIp =
  (req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    "").split(",")[0].trim();

const ip = rawIp || null;
const userAgent = req.headers["user-agent"] || null;
const referrer = req.headers["referer"] || null;

console.log(">>> ROTA /widget/:clientId/posts CHAMADA", {
  clientId,
  ip,
  userAgent,
  referrer,
});

try {

const configRow = await db.getConfig(clientId);

if (!configRow) {
  return res.status(404).json({ error: "Configuração não encontrada." });
}

let realClientId = clientId; // fallback padrão

if (configRow) {
  realClientId =
    configRow.licenseid ||
    configRow.licenseId ||
    configRow.clientid ||
    configRow.clientId ||
    clientId;
  }

// REGISTRA LOG
// valida se o licenseId existe na tabela allowed_clients
let isValid = false;

if (realClientId) {
  const check = await db.query(
    `SELECT 1 FROM allowed_clients WHERE "clientId" = $1 LIMIT 1`,
    [realClientId]
  );
  isValid = check.rows.length > 0;
}
  if (!isValid) {
  return res.status(403).json({
    error: "Licença não autorizada."
  });
  }

// REGISTRA LOG (AGORA CORRETO)
try {
  await db.logAccess(clientId, ip, userAgent, referrer, isValid, {
    route: "/widget/:clientId/posts",
    realClientId: realClientId
  });

  console.log("<<< LOG INSERT OK", {
    widgetId: clientId,
    licenseId: realClientId,
    isValid
  });

} catch (e) {
  console.error("!!! ERRO AO LOGAR:", e);
    }

// CONSULTA NOTION
const results = await queryDatabase(
  configRow.token,
  configRow.databaseId
);

    const posts = results
      .map((page) => {
        const props = page.properties;

        const title =
          props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;
        const editoria =
          props["Editoria"]?.select?.name || null;

        const files =
          props["Mídia"]?.files?.map(
            (file) => file.file?.url || file.external?.url
          ) || [];

        const linkDireto = props["Link da Mídia"]?.url
          ? [props["Link da Mídia"]?.url]
          : [];

        const embedDesign = props["Design Incorporado"]?.url
          ? [props["Design Incorporado"]?.url]
          : [];

        const media = [...embedDesign, ...files, ...linkDireto];

        const thumbnail =
          props["Capa do Vídeo"]?.files?.[0]?.file?.url ||
          props["Capa do Vídeo"]?.files?.[0]?.external?.url ||
          null;

        const ocultar = props["Ocultar Visualização"]?.checkbox;
        if (ocultar || media.length === 0) return null;

        const formato =
          props["Formato"]?.select?.name?.toLowerCase() || null;
        const fixado = props["Fixado"]?.number || null;

        return {
          id: page.id,
          title,
          date,
          editoria,
          media,
          thumbnail,
          formato,
          fixado,
        };
      })
      .filter(Boolean);

    return res.json(posts);
  } catch (err) {
    console.error("❌ Erro ao buscar posts:", err);

    db.logAccess(clientId, ip, userAgent, referrer, false, {
      error: String(err),
    });

    return res.status(500).json({
  error: "Não foi possível carregar os posts."
    });
  }
});

// Visualização do widget
app.get("/widget/:clientId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
