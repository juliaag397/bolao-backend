require("dotenv").config();
const pool = require("./db");

// ⚽ mesma lógica que você usa no backend
function calcularPontos(aposta, jogoOficial) {
  const golsApostaCasa = aposta.gols_casa;
  const golsApostaFora = aposta.gols_fora;

  const golsOficialCasa = jogoOficial.gols_casa;
  const golsOficialFora = jogoOficial.gols_fora;

  // 🔥 1️⃣ Placar exato
  if (
    golsApostaCasa === golsOficialCasa &&
    golsApostaFora === golsOficialFora
  ) {
    return 10;
  }

  // Resultado da aposta
  const resultadoAposta =
    golsApostaCasa > golsApostaFora
      ? "casa"
      : golsApostaCasa < golsApostaFora
      ? "fora"
      : "empate";

  // Resultado oficial
  const resultadoOficial =
    golsOficialCasa > golsOficialFora
      ? "casa"
      : golsOficialCasa < golsOficialFora
      ? "fora"
      : "empate";

  // 🔥 2️⃣ Se acertou vencedor ou empate
  if (resultadoAposta === resultadoOficial) {

    // 👉 Se for empate
    if (resultadoOficial === "empate") {
      return 3; // Empate simples (já sabemos que não foi placar exato)
    }

    // 👉 Se for vitória (casa ou fora)
    const diferencaAposta = Math.abs(golsApostaCasa - golsApostaFora);
    const diferencaOficial = Math.abs(golsOficialCasa - golsOficialFora);

    // 🔥 Vencedor + diferença correta
    if (diferencaAposta === diferencaOficial) {
      return 6;
    }

    // 🔥 Vencedor seco
    return 4;
  }

  // ❌ Errou tudo
  return 0;
}

async function recalcular() {
  try {
    console.log("🔄 Recalculando pontuação...");

    // 1️⃣ Buscar todos usuários
    const usuariosResult = await pool.query("SELECT id, nome FROM usuarios");
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
        // 3️⃣ Buscar resultado oficial
        const jogoOficialResult = await pool.query(
          "SELECT * FROM jogos_oficiais WHERE jogo = $1",
          [aposta.jogo]
        );

        if (jogoOficialResult.rows.length === 0) continue;

        const jogoOficial = jogoOficialResult.rows[0];

        totalPontos += calcularPontos(aposta, jogoOficial);
      }

      // 4️⃣ Atualizar pontos no banco
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