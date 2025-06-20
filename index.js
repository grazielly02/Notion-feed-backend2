const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { NotionAPI } = require("notion-client");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Função para extrair o databaseId de uma URL Notion
function extractDatabaseIdFromUrl(url) {
  const regex = /([a-f0-9]{32})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// Função para consultar Notion com o novo token ntn_
async function queryDatabase(token, databaseId) {
  const api = new NotionAPI({ authToken: token });

  try {
    const page = await api.getPage(databaseId);
    return page;
  } catch (error) {
    console.error("Erro ao consultar Notion API com token ntn_:", error);
    throw error;
  }
}

// Rota inicial (index.html padrão)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota para o formulário de configuração
app.get("/form.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// Salvar configuração do cliente
app.post("/save-config", (req, res) => {
  const { clientId, token, databaseUrl } = req.body;

  if (!clientId || !token || !databaseUrl) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const databaseId = extractDatabaseIdFromUrl(databaseUrl);

  if (!databaseId) {
    return res.status(400).send("Database ID inválido na URL.");
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

  res.redirect(`/widget/${clientId}/view`);
});

// Rota para JSON de posts
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;
  const configPath = path.join(__dirname, "configs", `${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

  try {
    const dbResults = await queryDatabase(configData.token, configData.databaseId);

    const posts = Object.values(dbResults?.recordMap?.block || {})
      .filter(block => block.value && block.value.type === "page")
      .map(block => ({
        id: block.value.id,
        title: block.value.properties?.title?.[0]?.[0] || "Sem título"
      }));

    res.json(posts);
  } catch (error) {
    console.error(`Erro ao buscar posts de ${clientId}:`, error);
    res.status(500).json({ error: "Erro ao buscar posts." });
  }
});

// Rota para visualização tipo grid (simples, pode melhorar depois)
app.get("/widget/:clientId/view", async (req, res) => {
  const clientId = req.params.clientId;
  const configPath = path.join(__dirname, "configs", `${clientId}.json`);

  if (!fs.existsSync(configPath)) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  const configData = JSON.parse(fs.readFileSync(configPath, "utf8"));

  try {
    const dbResults = await queryDatabase(configData.token, configData.databaseId);

    const postsHtml = dbResults
      .map(page => {
        const props = page.properties;

        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";

        const dataPublicacao = props["Data de Publicação"]?.date?.start || null;

        const midias = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url || null;

        // Gera HTML das mídias
        const midiasHtml = midias.map(url => `
          <img src="${url}" alt="${title}" style="width:100%; max-height:300px; object-fit:cover; margin-bottom:10px;">
        `).join("");

        return `
          <div style="border:1px solid #ccc; padding:10px; margin:10px; width:300px;">
            <h3>${title}</h3>
            ${dataPublicacao ? `<p><strong>Data:</strong> ${dataPublicacao}</p>` : ""}
            ${midiasHtml || "<p>Sem mídia.</p>"}
            ${linkDireto ? `<p><a href="${linkDireto}" target="_blank">Ver mais</a></p>` : ""}
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
          body { font-family: Arial; display: flex; flex-wrap: wrap; justify-content: center; background: #f9f9f9; }
        </style>
      </head>
      <body>
        ${postsHtml || "<p>Sem posts disponíveis.</p>"}
      </body>
      </html>
    `);

  } catch (error) {
    console.error(`Erro ao gerar o widget de ${clientId}:`, error.response?.data || error.message);
    res.status(500).send("Erro ao gerar o widget visual.");
  }
});

// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});