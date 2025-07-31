const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const db = require("./db");

async function ensureTableExists() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS configs (
        clientId TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        databaseId TEXT NOT NULL
      );
    `);
    console.log("✅ Tabela 'configs' verificada/criada com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao criar/verificar tabela configs:", error);
  }
}

ensureTableExists();

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use("/widget/:clientId", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function extractDatabaseId(input) {
  const regex = /([a-f0-9]{32})/;
  const match = input.match(regex);
  return match ? match[1] : input;
}

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

// Rota inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota para exibir o formulário
app.get("/config", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// Rota para salvar configurações
app.post("/save-config", async (req, res) => {
  const { clientId, token, databaseId } = req.body;

  if (!clientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const cleanDatabaseId = extractDatabaseId(databaseId);

  try {
    await db.saveConfig(clientId, token, cleanDatabaseId);
    console.log(`✅ Configuração salva: clientId=${clientId}, databaseId=${cleanDatabaseId}`);

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
    console.error("❌ Erro ao salvar config no banco:", error.message);
    res.status(500).send("Erro ao salvar configuração.");
  }
});

// Rota que retorna os posts do Notion para o widget
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;

  try {
    const configRow = await db.getConfig(clientId);
    console.log("🔍 Config carregada do banco:", configRow);

    if (!configRow) {
      return res.status(404).send("Configuração deste cliente não encontrada.");
    }

    const results = await queryDatabase(configRow.token, configRow.databaseId);

    const posts = results
      .map(page => {
        const props = page.properties;
        const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
        const date = props["Data de Publicação"]?.date?.start || null;
        const editoria = props["Editoria"]?.select?.name || null;

        const files = props["Mídia"]?.files?.map(file =>
  file.file?.url || file.external?.url
) || [];

const linkDireto = props["Link da Mídia"]?.url ? [props["Link da Mídia"].url] : [];

// Novo campo para design incorporado (Canva/Figma)
const embedDesign = props["Design Incorporado"]?.url ? [props["Design Incorporado"].url] : [];

const media = [...embedDesign, ...files, ...linkDireto];

        const thumbnail = props["Capa do Vídeo"]?.files?.[0]?.file?.url 
                       || props["Capa do Vídeo"]?.files?.[0]?.external?.url 
                       || null;

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
    res.status(500).json({ error: error.message });
  }
});

// Rota para visualizar o widget
app.get("/widget/:clientId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Inicializa o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
