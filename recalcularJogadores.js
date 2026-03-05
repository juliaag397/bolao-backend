require("dotenv").config();
const pool = require("./db");

async function recalcularJogadores() {

  try {

    console.log("⚽ Recalculando pontos dos jogadores...");

    const apostas = await pool.query(`
      SELECT id, jogo_id
      FROM apostas
    `);

    for (let aposta of apostas.rows) {

      // jogadores apostados
      const apostados = await pool.query(`
        SELECT id, jogador_nome
        FROM aposta_jogadores
        WHERE aposta_id = $1
      `, [aposta.id]);

      // jogadores que realmente fizeram gol
      const gols = await pool.query(`
        SELECT jogador_nome
        FROM gols_brasil
        WHERE jogo_id = $1
      `, [aposta.jogo_id]);

      const jogadoresGols = gols.rows.map(g => g.jogador_nome);

      for (let jogador of apostados.rows) {

        let pontos = 0;

        if (jogadoresGols.includes(jogador.jogador_nome)) {
          pontos = 3;
        }

        await pool.query(`
          UPDATE aposta_jogadores
          SET pontos = $1
          WHERE id = $2
        `, [pontos, jogador.id]);

      }

    }

    console.log("✅ Pontos dos jogadores atualizados!");

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    process.exit();
  }

}

recalcularJogadores();