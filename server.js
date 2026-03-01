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

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

app.set("trust proxy", 1);

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: "user_sessions"
  }),
  secret: "segredo-super-seguro",
  resave: false,
  saveUninitialized: false,
  proxy: true,
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

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome
    };

    res.json({
      sucesso: true,
      id: usuario.id,
      nome: usuario.nome
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro no servidor" });
  }
});

app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ mensagem: "Logout realizado" });
    });
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
// ===============================
// SALVAR OU ATUALIZAR APOSTA ARTILHEIRO
// ===============================

app.post("/salvar-artilheiro", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;
  const { tipo, jogador } = req.body;

  try {

    await pool.query(
      `
      INSERT INTO aposta_artilheiro (usuario_id, tipo, jogador)
      VALUES ($1, $2, $3)
      ON CONFLICT (usuario_id, tipo)
      DO UPDATE SET
        jogador = EXCLUDED.jogador
      `,
      [usuario_id, tipo, jogador]
    );

    res.json({ sucesso: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao salvar artilheiro" });
  }

});

// ===============================
// BUSCAR APOSTAS ARTILHEIRO DO USUÁRIO
// ===============================

app.get("/artilheiros", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;

  try {

    const resultado = await pool.query(
      "SELECT * FROM aposta_artilheiro WHERE usuario_id = $1",
      [usuario_id]
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar artilheiros" });
  }

});

app.get("/verificar-login", (req, res) => {

    if (req.session.usuario) {
        res.json({
            logado: true,
            id: req.session.usuario.id,
            nome: req.session.usuario.nome
        });
    } else {
        res.json({ logado: false });
    }

});



// SALVAR OU ATUALIZAR A APOSTA
app.post("/apostar", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;
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

app.post("/calcular-pontos/:usuarioId", async (req, res) => {
  const { usuarioId } = req.params;

  try {

    // 1️⃣ Buscar apostas do usuário
    const apostasResult = await pool.query(
      "SELECT * FROM apostas WHERE usuario_id = $1",
      [usuarioId]
    );

    const apostas = apostasResult.rows;

    let totalPontos = 0;

    for (let aposta of apostas) {

      // 2️⃣ Buscar resultado oficial do jogo
      const jogoOficialResult = await pool.query(
        "SELECT * FROM jogos_oficiais WHERE jogo = $1",
        [aposta.jogo]
      );

      if (jogoOficialResult.rows.length === 0) continue;

      const jogoOficial = jogoOficialResult.rows[0];

      const pontos = calcularPontos(aposta, jogoOficial);

      totalPontos += pontos;

      // salvar pontos na aposta
      await pool.query(
        "UPDATE apostas SET pontos = $1 WHERE usuario_id = $2 AND jogo = $3",
        [pontos, usuarioId, aposta.jogo]
      );
    }

    // ===== ARTIHEIRO =====

    const apostasArtilheiroResult = await pool.query(
      "SELECT * FROM aposta_artilheiro WHERE usuario_id = $1",
      [usuarioId]
    );

    const artilheiroOficialResult = await pool.query(
      "SELECT artilheiro_oficial FROM configuracoes LIMIT 1"
    );

    if (artilheiroOficialResult.rows.length > 0) {

      const artilheiroOficial =
        artilheiroOficialResult.rows[0].artilheiro_oficial;

      for (let aposta of apostasArtilheiroResult.rows) {

        if (aposta.jogador === artilheiroOficial) {

          if (aposta.tipo === "inicial") totalPontos += 25;
          if (aposta.tipo === "pos_grupos") totalPontos += 15;

        }
      }
    }

    // 3️⃣ Atualizar pontuação no usuário
    await pool.query(
      "UPDATE usuarios SET pontos = $1 WHERE id = $2",
      [totalPontos, usuarioId]
    );

    res.json({ message: "Pontuação atualizada!", totalPontos });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao calcular pontos" });
  }
});

app.get("/ranking", async (req, res) => {
  try {

    const resultado = await pool.query(
      "SELECT nome, pontos FROM usuarios ORDER BY pontos DESC"
    );

    res.json(resultado.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar ranking" });
  }
});

app.get("/jogos", async (req, res) => {
  const result = await pool.query("SELECT * FROM jogos_oficiais");
  res.json(result.rows);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});