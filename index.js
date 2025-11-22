const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const db = require("./db");

// FunÃ§Ã£o para gerar clientId aleatÃ³rio
function generateRandomId(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ðŸ”µ Garantir tabela configs
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
    console.log("âœ… Tabela 'configs' verificada/criada.");
  } catch (error) {
    console.error("âŒ Erro ao criar/verificar tabela configs:", error);
  }
}

// ðŸ”µ Garantir tabela allowed_clients
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
    console.log("âœ… Tabela 'allowed_clients' verificada/criada.");
  } catch (error) {
    console.error("âŒ Erro ao criar/verificar tabela allowed_clients:", error);
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

// Extrair databaseId do link do Notion
function extractDatabaseId(input) {
  const regex = /([a-f0-9]{32})/;
  const match = input.match(regex);
  return match ? match[1] : input;
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
    console.error("âŒ Erro ao consultar Notion:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao consultar Notion");
  }
}

// ðŸ“Œ ROTA NOVA â€” gerar clientId pelo e-mail
app.post("/generate-client", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Informe seu e-mail" });

  try {
    // Buscar cliente existente
    let client = await db.getAllowedClientByEmail(email);

    if (!client) {
      // Criar novo clientId
      const clientId = generateRandomId(10);
      await db.saveAllowedClient(email, clientId);
      client = { email, clientId };
    }

    return res.json({
      success: true,
      clientId: client.clientId,
      setupUrl: `https://meu-widget-feed.netlify.app/form.html?clientId=${client.clientId}`
    });
  } catch (error) {
    console.error("âŒ Erro ao gerar clientId:", error.message);
    return res.status(500).json({ error: "Erro ao gerar link" });
  }
});

// PÃ¡gina inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// PÃ¡gina de formulÃ¡rio
app.get("/config", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// Salvar token/databaseId no configs
app.post("/save-config", async (req, res) => {
  const { clientId, token, databaseId } = req.body;

  if (!clientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos sÃ£o obrigatÃ³rios.");
  }

  const cleanDatabaseId = extractDatabaseId(databaseId);

  try {
    await db.saveConfig(clientId, token, cleanDatabaseId);
    console.log(`âœ… ConfiguraÃ§Ã£o salva: clientId=${clientId}`);

    const finalUrl = `https://meu-widget-feed.netlify.app/previsualizacao.html?clientId=${encodeURIComponent(clientId)}`;

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
    console.error("âŒ Erro ao salvar configuraÃ§Ã£o:", error.message);
    res.status(500).send("Erro ao salvar configuraÃ§Ã£o.");
  }
});

// Buscar posts do Notion
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;

  try {
    const configRow = await db.getConfig(clientId);

    if (!configRow) {
      return res.status(404).send("ConfiguraÃ§Ã£o deste cliente nÃ£o encontrada.");
    }

    const results = await queryDatabase(configRow.token, configRow.databaseId);

    const posts = results
      .map(page => {
        const props = page.properties;
        const title = props["Post"]?.title?.[0]?.plain_text || "Sem tÃ­tulo";
        const date = props["Data de PublicaÃ§Ã£o"]?.date?.start || null;
        const editoria = props["Editoria"]?.select?.name || null;
        const files = props["MÃ­dia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];
        const linkDireto = props["Link da MÃ­dia"]?.url ? [props["Link da MÃ­dia"].url] : [];
        const embedDesign = props["Design Incorporado"]?.url ? [props["Design Incorporado"].url] : [];
        const media = [...embedDesign, ...files, ...linkDireto];
        const thumbnail =
          props["Capa do VÃ­deo"]?.files?.[0]?.file?.url ||
          props["Capa do VÃ­deo"]?.files?.[0]?.external?.url ||
          null;
        const ocultar = props["Ocultar VisualizaÃ§Ã£o"]?.checkbox;
        if (ocultar || media.length === 0) return null;
        const formato = props["Formato"]?.select?.name?.toLowerCase() || null;
        const fixado = props["Fixado"]?.number || null;
        return { id: page.id, title, date, editoria, media, thumbnail, formato, fixado };
      })
      .filter(Boolean);

    res.json(posts);

  } catch (error) {
    console.error("âŒ Erro ao buscar posts:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ExibiÃ§Ã£o do widget
app.get("/widget/:clientId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ðŸš€ Servidor rodando na porta ${PORT}`);
});
