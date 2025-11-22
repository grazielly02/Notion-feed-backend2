import express from "express";
import cors from "cors";
import db from "./db.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: ["https://meu-widget-feed.netlify.app", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

// ---------------------------------------------------
// NÃO CRIA MAIS TABELAS INCORRETAS
// (seu banco já possui a estrutura real)
// ---------------------------------------------------

// ---------------------------------------------------
// Capturar IP
// ---------------------------------------------------
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ---------------------------------------------------
// Rota: Gerar link exclusivo
// ---------------------------------------------------
app.post("/generate-client", async (req, res) => {
  try {
    const { email } = req.body;
    const ip = getIP(req);
    const ua = req.headers["user-agent"] || "unknown";

    if (!email) {
      await db.logAccess(null, "generate_client_missing_email", ip, ua);
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    // Verifica se está na lista permitida
    const allowed = await db.query(
      `SELECT * FROM allowed_clients WHERE email = $1`,
      [email]
    );

    if (allowed.rowCount === 0) {
      await db.logAccess(null, "generate_client_not_allowed", ip, ua, { email });
      return res.status(403).json({ error: "Email não autorizado" });
    }

    const clientId = allowed.rows[0].clientid;

    // Verifica se já tem config
    const existingConfig = await db.query(
      `SELECT * FROM configs WHERE "clientId" = $1`,
      [clientId]
    );

    if (existingConfig.rowCount > 0) {
      await db.logAccess(clientId, "generate_client_existing", ip, ua);
      return res.json({
        clientId,
        setupUrl: `https://meu-widget-feed.netlify.app/widget.html?clientId=${clientId}`,
      });
    }

    // Cria configuração vazia
    await db.query(
      `INSERT INTO configs ("clientId", token, "databaseId") VALUES ($1, '', '')`,
      [clientId]
    );

    await db.logAccess(clientId, "generate_client_new", ip, ua);

    return res.json({
      clientId,
      setupUrl: `https://meu-widget-feed.netlify.app/widget.html?clientId=${clientId}`,
    });

  } catch (err) {
    console.error("Erro generate-client:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---------------------------------------------------
// Salvar configurações do cliente
// ---------------------------------------------------
app.post("/save-config", async (req, res) => {
  try {
    const { clientId, notionToken, databaseId } = req.body;
    const ip = getIP(req);
    const ua = req.headers["user-agent"] || "unknown";

    if (!clientId) {
      await db.logAccess(null, "save_config_missing_client", ip, ua);
      return res.status(400).json({ error: "clientId é obrigatório" });
    }

    await db.query(
      `UPDATE configs SET token = $1, "databaseId" = $2 WHERE "clientId" = $3`,
      [notionToken, databaseId, clientId]
    );

    await db.logAccess(clientId, "save_config_success", ip, ua);

    return res.json({ success: true });

  } catch (err) {
    console.error("Erro save-config:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// ---------------------------------------------------
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
