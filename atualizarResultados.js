const pool = require("./db");

async function atualizar() {

  await pool.query(
    `
    INSERT INTO jogos_oficiais (jogo, gols_casa, gols_fora)
    VALUES ($1, $2, $3)
    ON CONFLICT (jogo)
    DO UPDATE SET
      gols_casa = EXCLUDED.gols_casa,
      gols_fora = EXCLUDED.gols_fora
    `,
    ['México x África do Sul - 11/06', 3, 0]
  );

  console.log("Resultado atualizado!");
  process.exit();
}

atualizar();