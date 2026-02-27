console.log("PGUSER:", process.env.PGUSER);
console.log("PGHOST:", process.env.PGHOST);
console.log("PGDATABASE:", process.env.PGDATABASE);

const pool = require("./db");
const session = require("express-session");

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

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.set("trust proxy", 1);

app.use(session({
  secret: "segredo-super-seguro",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    sameSite: "none"
  }
}));



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

    req.session.usuarioId = usuario.id; // 🔥 ESSENCIAL

    res.json({ sucesso: true });

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

// ARTILHEIRO
app.post("/salvar-artilheiro", async (req, res) => {

    // 🔐 1️⃣ Verifica se está logado (NÃO pode confiar no usuarioId vindo do front)
    if (!req.session.usuarioId) {
        return res.status(401).json({ erro: "Usuário não autenticado" });
    }

    const usuarioId = req.session.usuarioId;
    const { tipo, jogador } = req.body;

    if (!tipo || !jogador) {
        return res.status(400).json({ erro: "Dados incompletos" });
    }

    const hoje = new Date();

    const inicioCopa = new Date("2026-06-11");
    const fimFaseGrupos = new Date("2026-06-25");
    const inicioMataMata = new Date("2026-06-28");

    // 🥇 APOSTA INICIAL
    if (tipo === "inicial" && hoje >= inicioCopa) {
        return res.status(400).json({ erro: "Prazo encerrado" });
    }

    // 🥈 APOSTA PÓS-GRUPOS
    if (tipo === "pos_grupos" && (hoje < fimFaseGrupos || hoje >= inicioMataMata)) {
        return res.status(400).json({ erro: "Segunda aposta bloqueada" });
    }

    try {
        await pool.query(
            `INSERT INTO aposta_artilheiro (usuario_id, tipo, jogador)
             VALUES ($1, $2, $3)
             ON CONFLICT (usuario_id, tipo)
             DO UPDATE SET jogador = EXCLUDED.jogador`,
            [usuarioId, tipo, jogador]
        );

        res.json({ sucesso: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao salvar aposta" });
  }

});

app.get("/verificar-login", (req, res) => {
    res.json({ logado: !!req.session.usuarioId });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// SALVAR OU ATUALIZAR A APOSTA
app.post("/apostar", async (req, res) => {

  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuarioId;
  const { jogo, gols_casa, gols_fora } = req.body;

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