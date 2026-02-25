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
    // Verifica se já existe email no banco
    const usuarioExistente = await pool.query(
      "SELECT * FROM usuarios WHERE email = $1",
      [email]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.json({ erro: "E-mail já cadastrado!" });
    }

    // Insere usuário no banco
    await pool.query(
      "INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3)",
      [nome, email, senha]
    );

    res.json({ mensagem: "Cadastro realizado com sucesso!" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro no servidor" });
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

    res.json({ usuario });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro no servidor" });
  }
});

// ===============================

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});