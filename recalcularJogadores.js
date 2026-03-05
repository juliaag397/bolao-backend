require("dotenv").config();
const pool = require("./db");

async function calcularPontosJogadores(apostaId, jogoId) {

  // jogadores apostados
  const apostaJogadores = await pool.query(
    `SELECT jogador_nome
     FROM aposta_jogadores
     WHERE aposta_id = $1`,
    [apostaId]
  );

  // jogadores que realmente fizeram gol
  const gols = await pool.query(
    `SELECT jogador_nome
     FROM gols_brasil
     WHERE jogo_id = $1`,
    [jogoId]
  );

  const jogadoresApostados = apostaJogadores.rows.map(j => j.jogador_nome);
  const jogadoresGols = gols.rows.map(g => g.jogador_nome);

  let pontos = 0;

  jogadoresApostados.forEach(jogador => {
    if (jogadoresGols.includes(jogador)) {
      pontos += 3;
    }
  });

  return pontos;
}

async function recalcularJogadores() {

  try {

    console.log("⚽ Recalculando pontos dos jogadores...");

    // buscar todas apostas
    const apostasResult = await pool.query(
      `SELECT id, jogo_id FROM apostas`
    );

    const apostas = apostasResult.rows;

    for (let aposta of apostas) {

      const pontos = await calcularPontosJogadores(
        aposta.id,
        aposta.jogo_id
      );

      await pool.query(
        `UPDATE apostas
         SET pontos_jogadores = $1
         WHERE id = $2`,
        [pontos, aposta.id]
      );

      console.log(`Aposta ${aposta.id} = ${pontos} pontos`);
    }

    console.log("🏆 Pontuação de jogadores atualizada!");

  } catch (erro) {

    console.error("Erro:", erro);

  } finally {

    await pool.end();
    process.exit();

  }
}

recalcularJogadores();