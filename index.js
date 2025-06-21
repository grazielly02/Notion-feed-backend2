const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Função para extrair o ID puro de uma URL de database do Notion ===
function extractDatabaseId(input) {
  const regex = /([a-f0-9]{32})/;
  const match = input.match(regex);
  return match ? match[1] : input; // Se for URL, extrai. Se já for o ID puro, mantém.
}

// === Função para consultar a API Notion usando token ntn_ ou secret_ ===
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
    console.error("Erro na API do Notion:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao consultar Notion");
  }
}

// === Rota inicial ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Rota para salvar a configuração de cada cliente ===
app.post("/save-config", (req, res) => {
  const { clientId, token, databaseId } = req.body;

  if (!clientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const configDir = path.join(__dirname, "configs");
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir);

  const configData = {
    token,
    databaseId: extractDatabaseId(databaseId)
  };

  const configPath = path.join(configDir, `${clientId}.json`);
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

  res.redirect(`/widget/${clientId}/view`);
});

// === Rota para buscar os posts JSON de um cliente específico ===
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;
  const configPath = path.join(__dirname, "configs", `${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

  try {
    const results = await queryDatabase(configData.token, configData.databaseId);

    const posts = results
      .map(page => {
        const props = page.properties;
        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url ? [props["Link Direto"].url] : [];
        const media = [...files, ...linkDireto];

        if (media.length === 0) return null;

        return { id: page.id, title, date, media };
      })
      .filter(Boolean);

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === Rota para visualizar o widget de um cliente ===
app.get("/widget/:clientId/view", async (req, res) => {
  const clientId = req.params.clientId;
  const configPath = path.join(__dirname, "configs", `${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

  try {
    const results = await queryDatabase(configData.token, configData.databaseId);

    const postsHtml = results
      .map(page => {
        const props = page.properties;
        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url ? [props["Link Direto"].url] : [];
        const media = [...files, ...linkDireto];

        if (media.length === 0) return null;

        const mediaHtml = media
          .map(url => `<img src="${url}" alt="${title}" style="width:100%; max-height:300px; object-fit:cover; margin-bottom:10px;">`)
          .join("");

        return `
          <div style="border:1px solid #ccc; padding:10px; margin:10px; width:300px;">
            <h3>${title}</h3>
            ${mediaHtml}
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
        <title>Widget de ${clientId}</title>
        <style>
          body { font-family: Arial, sans-serif; display: flex; flex-wrap: wrap; justify-content: center; background: #f9f9f9; }
        </style>
      </head>
      <body>
        ${postsHtml || "<p>Sem posts disponíveis.</p>"}
      </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao gerar o widget visual.");
  }
});

// === Porta ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});