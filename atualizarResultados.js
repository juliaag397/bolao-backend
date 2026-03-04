const pool = require("./db");

async function atualizar() {

  await pool.query(
    `
    UPDATE jogos_oficiais
    SET gols_casa = $1,
        gols_fora = $2
    WHERE jogo = $3
    `,
    [3, 0, 'México x África do Sul - 11/06']
  );

  console.log("Resultado atualizado!");
  process.exit();
}

atualizar();