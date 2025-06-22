const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.static("public"));
// Corrige carregamento de arquivos estáticos nas rotas dinâmicas
app.use("/widget/:clientId", express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// === Função: extrair ID puro da database (mesmo quando o cliente cola a URL inteira) ===
function extractDatabaseId(input) {
  const regex = /([a-f0-9]{32})/;
  const match = input.match(regex);
  return match ? match[1] : input;
}

// === Função: consulta API do Notion ===
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

// === Rota inicial ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Rota: formulário de configuração ===
app.get("/config", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// === Rota: salvar configuração de cliente no PostgreSQL ===
app.post("/save-config", async (req, res) => {
  const { clientId, token, databaseId } = req.body;

  if (!clientId || !token || !databaseId) {
    return res.status(400).send("Todos os campos são obrigatórios.");
  }

  const cleanDatabaseId = extractDatabaseId(databaseId);

  try {
    await db.saveConfig(clientId, token, cleanDatabaseId);
    res.redirect(`/widget/${clientId}/view`);
  } catch (error) {
    console.error("Erro ao salvar config no banco:", error);
    res.status(500).send("Erro ao salvar configuração.");
  }
});

// === Rota: retornar posts em JSON ===
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;

  try {
    const configRow = await db.getConfig(clientId);

    if (!configRow) {
      return res.status(404).send("Configuração deste cliente não encontrada.");
    }

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
    console.error("Erro ao buscar posts:", error);
    res.status(500).json({ error: error.message });
  }
});

// === Rota: exibir o widget visual ===
app.get("/widget/:clientId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === Porta ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});