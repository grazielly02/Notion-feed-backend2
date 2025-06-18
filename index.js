const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");
require("dotenv").config();

const app = express();
app.use(express.static("public"));

const notion = new Client({ auth: process.env.NOTION_TOKEN });

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

app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});