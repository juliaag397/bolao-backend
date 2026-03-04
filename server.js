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

    // 🔎 1️⃣ Buscar data do jogo
    const jogoResult = await pool.query(
      `SELECT data_jogo FROM jogos WHERE jogo = $1`,
      [jogo]
    );

    if (jogoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Jogo não encontrado" });
    }

    const dataJogo = new Date(jogoResult.rows[0].data_jogo);
    const agora = new Date();

    // 🔒 2️⃣ Bloquear se já começou
    if (agora >= dataJogo) {
      return res.status(403).json({
        erro: "Este jogo já começou. Não é possível alterar a aposta."
      });
    }

    // 3️⃣ Salvar aposta se estiver liberado
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

  // PARA PEGAR A PONTUAÇÃO TOTAL DO BANCO
app.get("/minha-pontuacao", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  try {
    const result = await pool.query(
      "SELECT pontos FROM usuarios WHERE id = $1",
      [req.session.usuario.id]
    );

    res.json({ pontos: result.rows[0].pontos });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar pontuação" });
  }
});

app.get("/jogos", async (req, res) => {
  const result = await pool.query("SELECT * FROM jogos");
  res.json(result.rows);
});

  // grupos

const crypto = require("crypto");

async function gerarCodigoUnico() {
  while (true) {

    // gera código forte criptograficamente
    const code = crypto.randomBytes(4)
      .toString("base64")
      .replace(/[^A-Z0-9]/gi, "")
      .substring(0, 6)
      .toUpperCase();

    const check = await pool.query(
      "SELECT id FROM groups WHERE code = $1",
      [code]
    );

    if (check.rows.length === 0) {
      return code;
    }
  }
}

app.post("/create-group", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const { name, rules } = req.body;
  const userId = req.session.usuario.id;

  // 🚨 VALIDAÇÃO BACKEND (OBRIGATÓRIA)
  if (!name || name.trim() === "") {
    return res.status(400).json({
      error: "O nome do grupo é obrigatório."
    });
  }

  if (!rules || rules.trim() === "") {
    return res.status(400).json({
      error: "As regras do grupo são obrigatórias."
    });
  }

  if (name.trim().length < 3) {
    return res.status(400).json({
      error: "O nome deve ter pelo menos 3 caracteres."
    });
  }

  try {

    const cleanName = name.trim();
    const cleanRules = rules.trim();

    // 🔐 gerar código seguro
    const code = await gerarCodigoUnico();

    // 1️⃣ Criar grupo
    const groupResult = await pool.query(
      `
      INSERT INTO groups (name, rules, code, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, code
      `,
      [cleanName, cleanRules, code, userId]
    );

    const group = groupResult.rows[0];

    // 2️⃣ Inserir criador como membro
    await pool.query(
      `
      INSERT INTO group_members (group_id, user_id, score)
      VALUES ($1, $2, 0)
      ON CONFLICT (group_id, user_id) DO NOTHING
      `,
      [group.id, userId]
    );

    res.json({
      success: true,
      code: group.code
    });

  } catch (erro) {
    console.error("Erro ao criar grupo:", erro);
    res.status(500).json({ error: "Erro no servidor" });
  }

});

app.get("/ranking-grupo/:groupId", async (req, res) => {

  const { groupId } = req.params;

  try {

    const result = await pool.query(
      `
      SELECT u.nome, gm.score
      FROM group_members gm
      JOIN usuarios u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY gm.score DESC
      `,
      [groupId]
    );

    res.json(result.rows);

  } catch (erro) {
    console.error("Erro ao buscar ranking:", erro);
    res.status(500).json({ erro: "Erro no servidor" });
  }

});

app.post("/join-group", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;
  const { code } = req.body;

  try {

    // 1️⃣ Buscar grupo pelo código
    const grupoResult = await pool.query(
      "SELECT id FROM groups WHERE code = $1",
      [code]
    );

    if (grupoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Grupo não encontrado" });
    }

    const group_id = grupoResult.rows[0].id;

    // 2️⃣ Inserir membro
    await pool.query(
      `
      INSERT INTO group_members (group_id, user_id, score)
      VALUES ($1, $2, 0)
      ON CONFLICT (group_id, user_id) DO NOTHING
      `,
      [group_id, usuario_id]
    );

    res.json({ sucesso: true });

  } catch (erro) {
    console.error("Erro ao entrar no grupo:", erro);
    res.status(500).json({ erro: "Erro no servidor" });
  }

});

app.get("/my-groups", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;

  try {

    const result = await pool.query(
      `
      SELECT g.id, g.name, g.code, g.rules
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = $1
      `,
      [usuario_id]
    );

    res.json(result.rows);

  } catch (erro) {
    console.error("Erro ao buscar grupos:", erro);
    res.status(500).json({ erro: "Erro no servidor" });
  }

});

//ABA BRASIL
app.post("/salvar-jogadores", async (req, res) => {

    const { aposta_id, jogadores } = req.body;

    // 1️⃣ Buscar aposta
    const { data: aposta, error } = await supabase
        .from("apostas")
        .select("*")
        .eq("id", aposta_id)
        .single();

    if (error || !aposta) {
        return res.status(404).json({ erro: "Aposta não encontrada" });
    }

    // 2️⃣ Descobrir gols do Brasil
    let golsBrasil;

    if (aposta.jogo.startsWith("Brasil")) {
        golsBrasil = aposta.gols_casa;
    } else {
        golsBrasil = aposta.gols_fora;
    }

    // 3️⃣ Validar quantidade
    if (jogadores.length !== golsBrasil) {
        return res.status(400).json({
            erro: "Quantidade de jogadores inválida"
        });
    }

    // 4️⃣ Salvar no banco
    const inserts = jogadores.map(jogador => ({
        aposta_id,
        jogador_nome: jogador
    }));

    await supabase
        .from("aposta_jogadores")
        .insert(inserts);

    res.json({ sucesso: true });

});

// ABA BRASIL - LISTAR JOGOS DO USUÁRIO
app.get("/jogos-brasil/:usuario_id", async (req, res) => {

    const { usuario_id } = req.params;

    // Buscar apostas do usuário que tenham Brasil no jogo
    const { data, error } = await supabase
        .from("apostas")
        .select("*")
        .eq("usuario_id", usuario)
        .ilike("jogo", "%Brasil%");

    if (error) {
        return res.status(500).json({ erro: "Erro ao buscar jogos" });
    }

    res.json(data);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});