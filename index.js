const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
const db = require("./db");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Utilitário — extrai databaseId do link do Notion
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
    throw new Error(error.response?.data?.message || error.message);
  }
}

// Rota para gerar clientId
app.post("/generate-client", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email é obrigatório." });

  try {
    // Verifica se já existe
    let client = await db.getAllowedClientByEmail(email);
    if (!client) {
      const clientId = uuidv4();
      await db.saveAllowedClient(email, clientId);
      client = { clientId };
    }

    const setupUrl = `https://meu-widget-feed.netlify.app/form.html?clientId=${client.clientId}`;

    return res.json({ setupUrl, clientId: client.clientId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Rota para salvar config do widget
app.post("/save-config", async (req, res) => {
  const { clientId, token, databaseId } = req.body;
  if (!clientId || !token || !databaseId) return res.status(400).send("Dados incompletos.");

  try {
    const cleanDatabaseId = extractDatabaseId(databaseId);
    await db.saveConfig(clientId, token, cleanDatabaseId);

    const finalUrl = `https://meu-widget-feed.netlify.app/previsualizacao.html?clientId=${encodeURIComponent(clientId)}`;
    res.send(`
      <html><body>
      <p>Redirecionando para seu widget...</p>
      <script>window.location.href="${finalUrl}"</script>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send("Erro ao salvar configuração.");
  }
});

// Buscar posts do Notion
app.get("/widget/:clientId/posts", async (req, res) => {
  const clientId = req.params.clientId;
  try {
    const config = await db.getConfig(clientId);
    if (!config) return res.status(404).send("Cliente não encontrado.");

    const results = await queryDatabase(config.token, config.databaseId);
    const posts = results.map(page => {
      const props = page.properties;
      const title = props["Post"]?.title?.[0]?.plain_text || "Sem título";
      const date = props["Data de Publicação"]?.date?.start || null;
      const media = (props["Mídia"]?.files?.map(f => f.file?.url || f.external?.url) || []);
      return { id: page.id, title, date, media };
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exibir widget
app.get("/widget/:clientId/view", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
