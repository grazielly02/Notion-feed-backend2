const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// === Notion padrão (só pra quem ainda não configurou cliente específico) ===
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Função para consulta à API Notion via HTTP manual (aceita ntn_ ou secret_)
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
    console.error("Erro ao consultar Notion API:", error.response?.data || error.message);
    throw error;
  }
}

// Rota inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota antiga: retorna posts padrão (se quiser manter)
app.get("/posts", async (req, res) => {
  try {
    const db = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID
    });

    const posts = db.results
      .map(page => {
        const props = page.properties;

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url ? [props["Link Direto"].url] : [];
        const media = [...files, ...linkDireto];

        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;

        if (media.length === 0) return null;

        return {
          id: page.id,
          title,
          date,
          media
        };
      })
      .filter(Boolean);

    res.json(posts);
  } catch (error) {
    console.error("Erro ao buscar posts do Notion:", error);
    res.status(500).json({ error: "Erro ao buscar posts" });
  }
});

// Rota para salvar configuração de cada cliente
app.post("/save-config", (req, res) => {
  const { clientId, token, databaseId } = req.body;

  if (!clientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const configDir = path.join(__dirname, "configs");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }

  const configPath = path.join(configDir, `${clientId}.json`);

  const configData = {
    token,
    databaseId
  };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

  // Redireciona para o widget visual do cliente
  res.redirect(`/widget/${clientId}/view`);
});

// Rota para gerar o JSON de posts por cliente
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;
  const configPath = path.join(__dirname, "configs", `${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

  try {
    const dbResults = await queryDatabase(configData.token, configData.databaseId);

    const posts = dbResults
      .map(page => {
        const props = page.properties;

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url ? [props["Link Direto"].url] : [];
        const media = [...files, ...linkDireto];

        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;

        if (media.length === 0) return null;

        return {
          id: page.id,
          title,
          date,
          media
        };
      })
      .filter(Boolean);

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar posts via Notion API." });
  }
});

app.get("/widget/:clientId/view", async (req, res) => {
  const clientId = req.params.clientId;
  const configPath = path.join(__dirname, "configs", `${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

  try {
    const dbResults = await queryDatabase(configData.token, configData.databaseId);

    const posts = dbResults
      .map(page => {
        const props = page.properties;

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url ? [props["Link Direto"].url] : [];
        const media = [...files, ...linkDireto];

        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";

        if (media.length === 0) return null;

        return `
          <div style="border:1px solid #ccc; padding:10px; margin:10px; width:300px;">
            <h3>${title}</h3>
            ${media.map(url => `<img src="${url}" alt="${title}" style="width:100%; max-height:300px; object-fit:cover; margin-bottom:10px;">`).join('')}
          </div>
        `;
      })
      .filter(Boolean)
      .join("");

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Feed de ${clientId}</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; justify-content: center; background: #f9f9f9; }
        </style>
      </head>
      <body>
        ${posts || "<p>Sem posts disponíveis.</p>"}
      </body>
      </html>
    `);
  } catch (error) {
    console.error(`Erro ao gerar o widget visual de ${clientId}:`, error.response?.data || error.message);
    res.status(500).send("Erro ao gerar o widget visual.");
  }
});

// Porta
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});