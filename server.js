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

app.set("trust proxy", 1);

app.use(cors({
  origin: (origin, callback) => {

    if (!origin) return callback(null, true);

    if (
      origin.includes("vercel.app") ||
      origin.includes("localhost")
    ) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(express.json());

const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

app.use(session({
  name: "bolao.sid",
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
    sameSite: "none",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7
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

    req.session.save(() => {
      res.json({
        sucesso: true,
        id: usuario.id,
        nome: usuario.nome
      });
    })


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
      `
      SELECT 
        a.id,
        a.usuario_id,
        a.jogo_id,
        a.gols_casa,
        a.gols_fora,
        a.pontos,
        a.classificado_apostado, 
        j.jogo,
        j.data_jogo
      FROM apostas a
      JOIN jogos j ON a.jogo_id = j.id
      WHERE a.usuario_id = $1
      `,
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

app.get("/obter-configuracoes", async (_req, res) => {
  try {
    // Buscamos todas as colunas importantes da tabela de configurações
    const result = await pool.query(
      `SELECT artilheiro_oficial, podio_1, podio_2, podio_3, data_limite_podio FROM configuracoes WHERE id = 1`
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar configurações" });
  }
});

app.get("/pontos-artilheiro", async (req, res) => {

  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;

  try {

    const result = await pool.query(
      `SELECT COALESCE(SUM(pontos),0) AS pontos
       FROM aposta_artilheiro
       WHERE usuario_id = $1`,
      [usuario_id]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar pontos do artilheiro" });
  }

});

app.get("/resultado-artilheiro", async (req, res) => {

  try {

    const result = await pool.query(
      `SELECT artilheiro_oficial, gols_artilheiro
       FROM configuracoes
       LIMIT 1`
    );

    res.json(result.rows[0]);

  } catch (error) {

    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar resultado do artilheiro" });

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

function obterMultiplicador(jogoId) {
    if (jogoId >= 73 && jogoId <= 88) return 1.5; // Pré-Oitavas
    if (jogoId >= 89 && jogoId <= 96) return 2.0; // Oitavas
    if (jogoId >= 97 && jogoId <= 100) return 3.0; // Quartas
    if (jogoId === 101 || jogoId === 102) return 4.0; // Semis
    if (jogoId === 103 || jogoId === 104) return 5.0; // Finais
    return 1.0; // Grupos
}

function determinarVencedorReal(jogo) {
    if (jogo.gols_casa > jogo.gols_fora) return "casa";
    if (jogo.gols_fora > jogo.gols_casa) return "fora";
    // Se for empate, retorna o que estiver na coluna vencedor_penaltis
    return jogo.vencedor_penaltis; 
}

// SALVAR OU ATUALIZAR A APOSTA
app.post("/apostar", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  const usuario_id = req.session.usuario.id;
  // 1. Adicionamos o classificado_apostado aqui:
  const { jogo_id, gols_casa, gols_fora, classificado_apostado } = req.body;

  try {
    // 🔎 Buscar data pelo ID
    const jogoResult = await pool.query(
      `SELECT data_jogo FROM jogos WHERE id = $1`,
      [jogo_id]
    );

    if (jogoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Jogo não encontrado" });
    }

    const dataJogo = new Date(jogoResult.rows[0].data_jogo);
    const agora = new Date();

    if (agora >= dataJogo) {
      return res.status(403).json({
        erro: "Este jogo já começou."
      });
    }

    // 🔥 2. Agora salvamos incluindo a nova coluna
    await pool.query(
      `
      INSERT INTO apostas (usuario_id, jogo_id, gols_casa, gols_fora, classificado_apostado)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (usuario_id, jogo_id)
      DO UPDATE SET
        gols_casa = EXCLUDED.gols_casa,
        gols_fora = EXCLUDED.gols_fora,
        classificado_apostado = EXCLUDED.classificado_apostado
      `,
      [usuario_id, jogo_id, gols_casa, gols_fora, classificado_apostado]
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
    const apostasResult = await pool.query(
      `SELECT * FROM apostas WHERE usuario_id = $1`,
      [usuarioId]
    );

    const apostas = apostasResult.rows;
    let totalPontos = 0;

    for (let aposta of apostas) {
      // Importante: No seu SQL, certifique-se de buscar a tabela correta (jogos ou jogos_oficiais)
      const jogoOficialResult = await pool.query(
        `SELECT * FROM jogos WHERE id = $1`, 
        [aposta.jogo_id]
      );

      if (jogoOficialResult.rows.length === 0) continue;
      const jogoOficial = jogoOficialResult.rows[0];

      // --- INÍCIO DA NOVA LÓGICA DE CÁLCULO ---
      let pontosBase = 0;

      // Cálculo clássico (10, 6, 4, 3)
      if (aposta.gols_casa === jogoOficial.gols_casa && aposta.gols_fora === jogoOficial.gols_fora) {
        pontosBase = 10;
      } else {
        const resAposta = aposta.gols_casa > aposta.gols_fora ? "casa" : aposta.gols_casa < aposta.gols_fora ? "fora" : "empate";
        const resOficial = jogoOficial.gols_casa > jogoOficial.gols_fora ? "casa" : jogoOficial.gols_casa < jogoOficial.gols_fora ? "fora" : "empate";

        if (resAposta === resOficial) {
          if (resOficial === "empate") {
            pontosBase = 3;
          } else {
            const diffAposta = Math.abs(aposta.gols_casa - aposta.gols_fora);
            const diffOficial = Math.abs(jogoOficial.gols_casa - jogoOficial.gols_fora);
            pontosBase = (diffAposta === diffOficial) ? 6 : 4;
          }
        }
      }

      // Aplica Multiplicador
      const mult = obterMultiplicador(jogoOficial.id);
      let pontosDoJogo = pontosBase * mult;

      // Bônus de Classificado (Mata-Mata)
      if (jogoOficial.id >= 73) {
        const vencedorReal = determinarVencedorReal(jogoOficial);
        // 'classificado_apostado' deve ser a coluna onde você salva a escolha do usuário
        if (aposta.classificado_apostado === vencedorReal) {
          pontosDoJogo += 3;
        }
      }
      // --- FIM DA NOVA LÓGICA ---

      totalPontos += pontosDoJogo;

      await pool.query(
        `UPDATE apostas SET pontos = $1 WHERE id = $2`,
        [pontosDoJogo, aposta.id]
      );
    }

    // ... (restante do código: Artilheiro, Jogadores, Pódio e Atualização Final do Usuário)
    // Mantenha o restante como está, pois eles apenas somam ao totalPontos.

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

  try {

    // 1️⃣ Buscar aposta
    const apostaResult = await pool.query(
      `SELECT * FROM apostas WHERE id = $1`,
      [aposta_id]
    );

    if (apostaResult.rows.length === 0) {
      return res.status(404).json({ erro: "Aposta não encontrada" });
    }

    const aposta = apostaResult.rows[0];

    // 2️⃣ Buscar o jogo pelo jogo_id
    const jogoResult = await pool.query(
      `SELECT * FROM jogos WHERE id = $1`,
      [aposta.jogo_id]
    );

    if (jogoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Jogo não encontrado" });
    }

    const jogo = jogoResult.rows[0];

    // 3️⃣ Descobrir gols do Brasil
    let golsBrasil;

    if (jogo.jogo.startsWith("Brasil")) {
      golsBrasil = aposta.gols_casa;
    } else {
      golsBrasil = aposta.gols_fora;
    }

    // 4️⃣ Validar quantidade
    if (jogadores.length !== golsBrasil) {
      return res.status(400).json({
        erro: "Quantidade de jogadores inválida"
      });
    }

    // 🔒 5️⃣ BLOQUEAR se jogo já começou
    const agora = new Date();
    const dataJogo = new Date(jogo.data_jogo);

    if (agora.getTime() >= dataJogo.getTime()) {
      return res.status(403).json({
        erro: "Este jogo já começou. Não é possível alterar jogadores."
      });
    }

    // 6️⃣ Apagar jogadores antigos
    await pool.query(
      `DELETE FROM aposta_jogadores WHERE aposta_id = $1`,
      [aposta_id]
    );

    // 7️⃣ Inserir novos jogadores
    for (const jogador of jogadores) {
      await pool.query(
        `INSERT INTO aposta_jogadores (aposta_id, jogador_nome)
         VALUES ($1, $2)`,
        [aposta_id, jogador]
      );
    }

    res.json({ sucesso: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao salvar jogadores" });
  }
});

// ABA BRASIL - LISTAR JOGOS DO USUÁRIO
app.get("/jogos-brasil/:usuarioId", async (req, res) => {

  const { usuarioId } = req.params;

  try {

    const resultado = await pool.query(`
      SELECT 
        a.id,
        a.jogo_id,
        j.jogo,
        j.data_jogo,
        a.gols_casa,
        a.gols_fora,

        COALESCE(SUM(aj.pontos),0) AS pontos_jogadores,

        CASE 
          WHEN j.jogo LIKE 'Brasil x%' THEN a.gols_casa
          ELSE a.gols_fora
        END AS gols_brasil

      FROM apostas a
      JOIN jogos j ON j.id = a.jogo_id
      LEFT JOIN aposta_jogadores aj
        ON aj.aposta_id = a.id

      WHERE a.usuario_id = $1
      AND j.jogo ILIKE '%Brasil%'

      GROUP BY 
        a.id,
        a.jogo_id,
        j.jogo,
        j.data_jogo,
        a.gols_casa,
        a.gols_fora

      ORDER BY j.data_jogo
    `, [usuarioId]);

    res.json(resultado.rows);

  } catch (error) {
    console.error("ERRO /jogos-brasil:", error);
    res.status(500).json({ erro: "Erro ao buscar jogos do Brasil" });
  }

});

app.get("/jogadores/:aposta_id", async (req, res) => {

  const { aposta_id } = req.params;

  try {

    const result = await pool.query(
      `SELECT jogador_nome
       FROM aposta_jogadores
       WHERE aposta_id = $1
       ORDER BY id`,
      [aposta_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar jogadores" });
  }

});

app.get("/gols-brasil/:jogo_id", async (req, res) => {

  const { jogo_id } = req.params;

  try {

    const result = await pool.query(
      `SELECT jogador_nome
       FROM gols_brasil
       WHERE jogo_id = $1`,
      [jogo_id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar gols" });
  }

});

app.get("/pontos-jogadores/:aposta_id", async (req, res) => {

  const { aposta_id } = req.params;

  try {

    const result = await pool.query(
      `SELECT COALESCE(SUM(pontos),0) AS pontos
       FROM aposta_jogadores
       WHERE aposta_id = $1`,
      [aposta_id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar pontos" });
  }

});

  //PODIO
app.post("/salvar-podio", async (req, res) => {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: "Não autenticado" });
  }

  // Converte para número inteiro para garantir que o banco aceite
  const usuario_id = parseInt(req.session.usuario.id); 
  const { primeiro, segundo, terceiro } = req.body;

  if (primeiro === segundo || primeiro === terceiro || segundo === terceiro) {
    return res.status(400).json({ erro: "Você não pode escolher o mesmo país para posições diferentes." });
  }

  try {

    // 1. Verificar se o tempo expirou
    const configResult = await pool.query("SELECT data_limite_podio FROM configuracoes LIMIT 1");
    const dataLimite = new Date(configResult.rows[0].data_limite_podio);
    const agora = new Date();

    if (agora > dataLimite) {
        return res.status(403).json({ erro: "As apostas do pódio já foram encerradas!" });
    }

    await pool.query(
      `
      INSERT INTO apostas_podio (usuario_id, primeiro_lugar, segundo_lugar, terceiro_lugar)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (usuario_id) 
      DO UPDATE SET
        primeiro_lugar = EXCLUDED.primeiro_lugar,
        segundo_lugar = EXCLUDED.segundo_lugar,
        terceiro_lugar = EXCLUDED.terceiro_lugar,
        updated_at = NOW()
      `,
      [usuario_id, primeiro, segundo, terceiro]
    );

    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro no pódio:", err.message);
    res.status(500).json({ erro: "Erro ao salvar no banco" });
  }
});

app.get("/obter-podio", async (req, res) => {
  if (!req.session.usuario) return res.status(401).json({ erro: "Não autenticado" });

  const usuario_id = req.session.usuario.id;

  try {
    // 1. Busca o palpite do usuário
    const palpiteResult = await pool.query(
      "SELECT primeiro_lugar, segundo_lugar, terceiro_lugar FROM apostas_podio WHERE usuario_id = $1",
      [usuario_id]
    );

    // 2. Busca o resultado oficial
    const oficialResult = await pool.query(
      "SELECT podio_1, podio_2, podio_3 FROM configuracoes WHERE id = 1"
    );

    if (palpiteResult.rows.length > 0) {
      const p = palpiteResult.rows[0];
      const o = oficialResult.rows[0] || {}; // Evita erro se a tabela estiver vazia

      // Função simples para comparar e dar 10 ou 0
      const calcular = (palpite, oficial) => {
        if (!oficial) return null; // Se não tem resultado oficial ainda, não mostra pontos
        return palpite === oficial ? 10 : 0;
      };

      res.json({
        ...p,
        pts1: calcular(p.primeiro_lugar, o.podio_1),
        pts2: calcular(p.segundo_lugar, o.podio_2),
        pts3: calcular(p.terceiro_lugar, o.podio_3)
      });
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro ao buscar pódio" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});