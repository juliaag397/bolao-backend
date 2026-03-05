const pool = require("./db");

async function atualizar() {

  const jogoId = 1;

  // apaga gols antigos
  await pool.query(
    `DELETE FROM gols_brasil WHERE jogo_id = $1`,
    [jogoId]
  );

  // adiciona gols reais
  const gols = [
    "Neymar",
    "Vinicius Jr",
    "Vinicius Jr"
  ];

  for (const jogador of gols) {
    await pool.query(
      `INSERT INTO gols_brasil (jogo_id, jogador_nome)
       VALUES ($1, $2)`,
      [jogoId, jogador]
    );
  }

  console.log("Gols atualizados!");
  process.exit();
}

atualizar();