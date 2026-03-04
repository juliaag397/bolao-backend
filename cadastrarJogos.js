const pool = require("./db");

async function cadastrar() {

  await pool.query(
    `
    INSERT INTO jogos_oficiais (jogo, data_jogo)
    VALUES ($1, $2)
    ON CONFLICT (jogo)
    DO UPDATE SET
      data_jogo = EXCLUDED.data_jogo
    `,
    ['México x África do Sul - 11/06', '2026-06-11 16:00:00']
  );

  console.log("Jogo cadastrado!");
  process.exit();
}

cadastrar();