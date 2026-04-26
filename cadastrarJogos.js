const pool = require("./db");

async function cadastrar() {

  const jogos = [
    ['92.1 x 92.2', '2026-07-05 21:00:00'],
    ['93.1 x 93.2', '2026-07-06 16:00:00'],
    ['94.1 x 94.2', '2026-07-06 21:00:00'],
    ['95.1 x 95.2', '2026-07-07 13:00:00'],
    ['96.1 x 96.2', '2026-07-07 17:00:00'],
    ['97.1 x 97.2', '2026-07-09 17:00:00'],
    ['98.1 x 98.2', '2026-07-10 16:00:00'],
    ['99.1 x 99.2', '2026-07-11 18:00:00'],
    ['100.1 x 100.2', '2026-07-11 22:00:00'],
    ['101.1 x 101.2', '2026-07-14 16:00:00'],
    ['102.1 x 102.2', '2026-07-15 16:00:00'],
    ['103.1 x 103.2', '2026-07-18 18:00:00'],
    ['104.1 x 104.2', '2026-07-19 16:00:00'],
  ];

  for (const jogo of jogos) {
    await pool.query(
      `
      INSERT INTO jogos (jogo, data_jogo)
      VALUES ($1, $2)
      ON CONFLICT (jogo)
      DO UPDATE SET
        data_jogo = EXCLUDED.data_jogo
      `,
      jogo
    );
  }

  console.log("Jogos cadastrados!");
  process.exit();
}

cadastrar();