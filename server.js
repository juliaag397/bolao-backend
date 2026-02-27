console.log("PGUSER:", process.env.PGUSER);
console.log("PGHOST:", process.env.PGHOST);
console.log("PGDATABASE:", process.env.PGDATABASE);

const pool = require("./db");

pool.query("SELECT NOW()")
  .then(res => {
    console.log("Banco conectado:", res.rows[0]);
  })
  .catch(err => {
    console.error("Erro ao conectar:", err);
  });

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());



// ===============================
// ROTA PRINCIPAL
// ===============================

app.get("/", (req, res) => {
  res.send("Servidor do Bolão está rodando 🚀");
});

// ===============================
// CADASTRO
// ===============================

app.post("/cadastro", async (req, res) => {
  const { nome, email, senha } = req.body;

  try {
    await pool.query(
      "INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3)",
      [nome, email, senha]
    );

    return res.json({ mensagem: "Cadastro realizado com sucesso!" });

  } catch (error) {
    console.error("Erro real:", error);

    // 🔥 Se for email duplicado (PostgreSQL)
    if (error.code === "23505") {
      return res.status(400).json({ erro: "E-mail já cadastrado!" });
    }

    return res.status(500).json({ erro: "Erro no servidor" });
  }
});

// ===============================
// LOGIN
// ===============================

app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const resultado = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.json({ erro: "Usuário não encontrado!" });
    }

    const usuario = resultado.rows[0];

    if (usuario.senha !== senha) {
      return res.json({ erro: "Senha incorreta!" });
    }

    res.json({
      id: usuario.id,
      nome: usuario.nome
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro no servidor" });
  }
});

// ===============================

const PORT = 3000;

// ===============================
// BUSCAR APOSTAS DO USUÁRIO
// ===============================

app.get("/apostas/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const resultado = await pool.query(
      "SELECT * FROM apostas WHERE usuario_id = $1",
      [usuarioId]
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar apostas" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// SALVAR OU ATUALIZAR A APOSTA
app.post("/apostar", async (req, res) => {
  const { usuario_id, jogo, gols_casa, gols_fora } = req.body;

  try {
    await pool.query(
      `
      INSERT INTO apostas (usuario_id, jogo, gols_casa, gols_fora)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (usuario_id, jogo)
      DO UPDATE SET
        gols_casa = EXCLUDED.gols_casa,
        gols_fora = EXCLUDED.gols_fora
      `,
      [usuario_id, jogo, gols_casa, gols_fora]
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao salvar aposta" });
  }
});

// ARTILHEIRO
app.post("/salvar-artilheiro", async (req, res) => {

    const { usuarioId, tipoAposta, jogador } = req.body;

    const hoje = new Date();

    const inicioCopa = new Date("2026-06-11");
    const fimFaseGrupos = new Date("2026-06-25");
    const inicioMataMata = new Date("2026-06-28");

    // VALIDAÇÃO DE PERÍODO (SEGURANÇA REAL)
    if (tipoAposta == 1 && hoje >= inicioCopa) {
        return res.status(400).json({ erro: "Prazo encerrado" });
    }

    if (tipoAposta == 2 && (hoje < fimFaseGrupos || hoje >= inicioMataMata)) {
        return res.status(400).json({ erro: "Período inválido" });
    }

    try {
        await db.query(
            "INSERT INTO apostas_artilheiro (usuario_id, tipo_aposta, jogador) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE jogador = ?",
            [usuarioId, tipoAposta, jogador, jogador]
        );

        res.json({ sucesso: true });

    } catch (err) {
        res.status(500).json({ erro: "Erro ao salvar aposta" });
    }

});