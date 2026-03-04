const pool = require("./db");

async function atualizar() {

  await pool.query(
    `
    UPDATE jogos
    SET gols_casa = $1,
        gols_fora = $2
    WHERE id = $3
    `,
    [3, 0, 1] // ← coloca o ID real do jogo aqui
  );

  console.log("Resultado atualizado!");
  process.exit();
}

atualizar();