const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Função: extrair o ID puro da database mesmo quando o cliente cola a URL inteira ===
function extractDatabaseId(input) {
  const regex = /([a-f0-9]{32})/;
  const match = input.match(regex);
  return match ? match[1] : input;
}

// === Função: consulta ao Notion (aceita tokens ntn_ ou secret_) ===
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
    console.error("Erro ao consultar API do Notion:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Erro ao consultar o Notion");
  }
}

// === Rota inicial (exibe o index.html ou redireciona pro form) ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Rota: formulário de configuração ===
app.get("/config", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// === Salvar configuração de cliente no SQLite ===
app.post("/save-config", (req, res) => {
  const { clientId, token, databaseId } = req.body;

  if (!clientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const cleanDatabaseId = extractDatabaseId(databaseId);

  try {
    db.prepare(`
      INSERT OR REPLACE INTO configs (clientId, token, databaseId)
      VALUES (?, ?, ?)
    `).run(clientId, token, cleanDatabaseId);

    res.redirect(`/widget/${clientId}/view`);
  } catch (error) {
    console.error("Erro ao salvar config no banco:", error);
    res.status(500).send("Erro ao salvar configuração.");
  }
});

// === Rota: API de posts em JSON para o frontend montar o grid ===
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;

  const configRow = db.prepare('SELECT * FROM configs WHERE clientId = ?').get(clientId);

  if (!configRow) {
    return res.status(404).send("Configuração deste cliente não encontrada.");
  }

  try {
    const results = await queryDatabase(configRow.token, configRow.databaseId);

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

// === Rota: renderizar o widget visual (grid + frontend) ===
app.get("/widget/:clientId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Porta ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});