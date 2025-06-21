const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { NotionClient } = require("@dragonwocky/notion-client");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Função para consultar o banco de dados com o novo Notion Client
async function queryDatabase(token, databaseId) {
  const notion = new NotionClient({ auth: token });

  try {
    const response = await notion.databases.query(databaseId);
    return response.results;
  } catch (error) {
    console.error("Erro ao consultar o Notion API:", error);
    throw error;
  }
}

// Rota inicial (formulário)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota para salvar a configuração do cliente
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
  const configData = { token, databaseId };

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));

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

        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url || null;

        if (files.length === 0 && !linkDireto) return null;

        return {
          id: page.id,
          title,
          date,
          media: files,
          link: linkDireto
        };
      })
      .filter(Boolean);

    res.json(posts);
  } catch (error) {
    console.error("Erro ao gerar JSON de posts:", error);
    res.status(500).json({ error: "Erro ao gerar JSON de posts." });
  }
});

// Rota para renderizar o widget visual (HTML)
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
        const date = props["Data de Publicação"]?.date?.start || null;

        const files = props["Mídia"]?.files?.map(file =>
          file.file?.url || file.external?.url
        ) || [];

        const linkDireto = props["Link Direto"]?.url || null;

        const midiasHtml = files.map(url => `
          <img src="${url}" alt="${title}" style="width:100%; max-height:300px; object-fit:cover; margin-bottom:10px;">
        `).join("");

        return `
          <div style="border:1px solid #ccc; padding:10px; margin:10px; width:300px;">
            <h3>${title}</h3>
            ${date ? `<p><strong>Data:</strong> ${date}</p>` : ""}
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
    console.error(`Erro ao gerar o widget visual de ${clientId}:`, error);
    res.status(500).send("Erro ao gerar o widget visual.");
  }
});

// Porta
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});