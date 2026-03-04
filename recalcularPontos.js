require("dotenv").config();
const pool = require("./db");

function calcularPontos(aposta, jogoOficial) {
  const golsApostaCasa = aposta.gols_casa;
  const golsApostaFora = aposta.gols_fora;

  const golsOficialCasa = jogoOficial.gols_casa;
  const golsOficialFora = jogoOficial.gols_fora;

  if (
    golsApostaCasa === golsOficialCasa &&
    golsApostaFora === golsOficialFora
  ) {
    return 10;
  }

  const resultadoAposta =
    golsApostaCasa > golsApostaFora
      ? "casa"
      : golsApostaCasa < golsApostaFora
      ? "fora"
      : "empate";

  const resultadoOficial =
    golsOficialCasa > golsOficialFora
      ? "casa"
      : golsOficialCasa < golsOficialFora
      ? "fora"
      : "empate";

  if (resultadoAposta === resultadoOficial) {

    if (resultadoOficial === "empate") {
      return 3;
    }

    const diferencaAposta = Math.abs(golsApostaCasa - golsApostaFora);
    const diferencaOficial = Math.abs(golsOficialCasa - golsOficialFora);

    if (diferencaAposta === diferencaOficial) {
      return 6;
    }

    return 4;
  }

  return 0;
}

async function recalcular() {
  try {
    console.log("🔄 Recalculando pontuação...");

    // 1️⃣ Buscar todos usuários
    const usuariosResult = await pool.query(
      "SELECT id, nome FROM usuarios"
    );
    const usuarios = usuariosResult.rows;

    for (let usuario of usuarios) {
      let totalPontos = 0;

      // 2️⃣ Buscar apostas do usuário
      const apostasResult = await pool.query(
        "SELECT * FROM apostas WHERE usuario_id = $1",
        [usuario.id]
      );

      const apostas = apostasResult.rows;

      for (let aposta of apostas) {

        // 🔥 Buscar resultado oficial usando jogo_id
        const jogoOficialResult = await pool.query(
          "SELECT * FROM jogos_oficiais WHERE jogo_id = $1",
          [aposta.jogo_id]
        );

        if (jogoOficialResult.rows.length === 0) continue;

        const jogoOficial = jogoOficialResult.rows[0];

        const pontosJogo = calcularPontos(aposta, jogoOficial);

        // Atualiza pontos da aposta
        await pool.query(
          "UPDATE apostas SET pontos = $1 WHERE id = $2",
          [pontosJogo, aposta.id]
        );

        totalPontos += pontosJogo;
      }

      // Atualiza total do usuário
      await pool.query(
        "UPDATE usuarios SET pontos = $1 WHERE id = $2",
        [totalPontos, usuario.id]
      );

      console.log(`✅ ${usuario.nome}: ${totalPontos} pontos`);
    }

    console.log("🏆 Pontuação de todos os usuários atualizada!");
  } catch (erro) {
    console.error("❌ Erro:", erro);
  } finally {
    await pool.end();
    process.exit();
  }
}

recalcular();