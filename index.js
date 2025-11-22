const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const db = require("./db");

// Função para gerar clientId aleatório
function generateRandomId(length = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 🔵 Garantir tabela configs
async function ensureConfigsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS configs (
        clientId TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        databaseId TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP
      );
    `);
    console.log("✅ Tabela 'configs' verificada/criada.");
  } catch (error) {
    console.error("❌ Erro ao criar/verificar tabela configs:", error);
  }
}

// 🔵 Garantir tabela allowed_clients
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
    console.log("✅ Tabela 'allowed_clients' verificada/criada.");
  } catch (error) {
    console.error("❌ Erro ao criar/verificar tabela allowed_clients:", error);
  }
}

ensureConfigsTable();
ensureAllowedClientsTable();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use("/widget/:clientId", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Extração do databaseId
function extractDatabaseId(input) {
  const regex = /([a-f0-9]{32})/;
  const match = input.match(regex);
  return match ? match[1] : input;
}

// Consulta Notion
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

// 📌 ROTA — gerar clientId
app.post("/generate-client", async (req, res) => {
  const { email } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"];

  if (!email) {
    await db.logAccess(null, "generate_client_missing_email", ip, ua);
    return res.status(400).json({ error: "Informe seu e-mail" });
  }

  try {
    // Buscar cliente existente
    let client = await db.getAllowedClientByEmail(email);

    if (!client) {
      // Criar novo clientId
      const clientId = generateRandomId(10);
      await db.saveAllowedClient(email, clientId);
      client = { email, clientId };

      await db.logAccess(clientId, "generate_client_new", ip, ua);
    } else {
      await db.logAccess(client.clientId, "generate_client_existing", ip, ua);
    }

    return res.json({
      success: true,
      clientId: client.clientId,
      setupUrl: `https://meu-widget-feed.netlify.app/form.html?clientId=${client.clientId}`
    });
  } catch (error) {
    console.error("❌ Erro ao gerar clientId:", error.message);
    await db.logAccess(null, "generate_client_error", ip, ua, { error: error.message });
    return res.status(500).json({ error: "Erro ao gerar link" });
  }
});

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Página do formulário
app.get("/config", async (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// Salvar token/databaseId
app.post("/save-config", async (req, res) => {
  const { clientId, token, databaseId } = req.body;

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"];

  if (!clientId || !token || !databaseId) {
    await db.logAccess(clientId, "save_config_missing_fields", ip, ua);
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const cleanDatabaseId = extractDatabaseId(databaseId);

  try {
    await db.saveConfig(clientId, token, cleanDatabaseId);

    await db.logAccess(clientId, "save_config_success", ip, ua);

    const finalUrl =
      `https://meu-widget-feed.netlify.app/previsualizacao.html?clientId=${encodeURIComponent(clientId)}`;

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
    await db.logAccess(clientId, "save_config_error", ip, ua, { error: error.message });
    res.status(500).send("Erro ao salvar configuração.");
  }
});

// Buscar posts do Notion
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"];

  try {
    const configRow = await db.getConfig(clientId);

    if (!configRow) {
      await db.logAccess(clientId, "get_posts_missing_config", ip, ua);
      return res.status(404).send("Configuração não encontrada.");
    }

    await db.logAccess(clientId, "get_posts", ip, ua);

    const results = await queryDatabase(configRow.token, configRow.databaseId);

    const posts = results
      .map(page => {
        const props = page.properties;

        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;
        const editoria = props["Editoria"]?.select?.name || null;

        const files =
          props["Mídia"]?.files?.map(file =>
            file.file?.url || file.external?.url
          ) || [];

        const linkDireto = props["Link da Mídia"]?.url
          ? [props["Link da Mídia"]?.url]
          : [];

        const embedDesign = props["Design Incorporado"]?.url
          ? [props["Design Incorporado"].url]
          : [];

        const media = [...embedDesign, ...files, ...linkDireto];

        const thumbnail =
          props["Capa do Vídeo"]?.files?.[0]?.file?.url ||
          props["Capa do Vídeo"]?.files?.[0]?.external?.url ||
          null;

        const ocultar = props["Ocultar Visualização"]?.checkbox;
        if (ocultar || media.length === 0) return null;

        const formato = props["Formato"]?.select?.name?.toLowerCase() || null;
        const fixado = props["Fixado"]?.number || null;

        return { id: page.id, title, date, editoria, media, thumbnail, formato, fixado };
      })
      .filter(Boolean);

    res.json(posts);

  } catch (error) {
    console.error("❌ Erro ao buscar posts:", error.message);
    await db.logAccess(clientId, "get_posts_error", ip, ua, { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Visualização do widget
app.get("/widget/:clientId/view", async (req, res) => {
  const clientId = req.params.clientId;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const ua = req.headers["user-agent"];

  await db.logAccess(clientId, "open_widget_view", ip, ua);

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
