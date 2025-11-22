const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  string de conexão: process.env.DATABASE_URL,
  ssl: { rejeitarNãoAutorizado: falso },
});

módulo.exports = {
  consulta: (texto, parâmetros) => pool.query(texto, parâmetros),

  // clientes_permitidos
  salvarClientePermitido: async (email, clientId) => {
    aguarde pool.query(
      `INSERT INTO allowed_clients (email, "clientId")
       VALORES ($1, $2)
       EM CASO DE CONFLITO (e-mail) NÃO FAÇA NADA`,
      [email.trim(), clientId.trim()]
    );
  },

  getAllowedClientByEmail: async (email) => {
    const res = await pool.query(
      `SELECT * FROM allowed_clients WHERE email=$1`,
      [email.trim()]
    );
    retornar res.rows[0];
  },

  // configurações
  saveConfig: async (clientId, token, databaseId) => {
    aguarde pool.query(
      `INSERT INTO configs ("clientId", token, "databaseId")
       VALORES ($1, $2, $3)
       EM CONFLITO ("clientId")
       ATUALIZE DEFINA token = EXCLUDED.token, "databaseId" = EXCLUDED."databaseId"`,
      [clientId.trim(), token.trim(), databaseId.trim()]
    );
  },

  getConfig: async (clientId) => {
    const res = await pool.query(
      `SELECT * FROM configs WHERE "clientId"=$1`,
      [clientId.trim()]
    );
    retornar res.rows[0];
  }
};
