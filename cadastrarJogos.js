const pool = require("./db");

async function cadastrar() {

  const jogos = [
    ['? x EUA - 25/06', '2026-06-25 23:00:00'],
    ['Paraguai x Austrália - 25/06', '2026-06-25 23:00:00'],
    ['Noruega x França - 26/06', '2026-06-26 16:00:00'],
    ['Senegal x ? - 26/06', '2026-06-26 16:00:00'],
    ['Cabo Verde x Arábia Saudita - 26/06', '2026-06-26 21:00:00'],
    ['Uruguai x Espanha - 26/06', '2026-06-26 21:00:00'],
    ['Nova Zelândia x Bélgica - 27/06', '2026-06-27 00:00:00'],
    ['Egito x Irã - 27/06', '2026-06-27 00:00:00'],
    ['Panamá x Inglaterra - 27/06', '2026-06-27 18:00:00'],
    ['Croácia x Gana - 27/06', '2026-06-27 18:00:00'],
    ['Colômbia x Portugal - 27/06', '2026-06-27 20:30:00'],
    ['? x Uzbequistão - 27/06', '2026-06-27 20:30:00'],
    ['Argélia x Áustria - 27/06', '2026-06-27 23:00:00'],
    ['Jordânia x Argentina - 27/06', '2026-06-27 23:00:00'],
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