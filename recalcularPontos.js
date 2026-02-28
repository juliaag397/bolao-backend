require("dotenv").config();
const pool = require("./db");

// ⚽ mesma lógica que você usa no backend
function calcularPontos(aposta, jogoOficial) {
  let pontos = 0;

  // Placar exato
  if (
    aposta.gols_casa === jogoOficial.gols_casa &&
    aposta.gols_fora === jogoOficial.gols_fora
  ) {
    return 10;
  }

  // Acertou vencedor ou empate
  const resultadoAposta =
    aposta.gols_casa > aposta.gols_fora
      ? "casa"
      : aposta.gols_casa < aposta.gols_fora
      ? "fora"
      : "empate";

  const resultadoOficial =
    jogoOficial.gols_casa > jogoOficial.gols_fora
      ? "casa"
      : jogoOficial.gols_casa < jogoOficial.gols_fora
      ? "fora"
      : "empate";

  if (resultadoAposta === resultadoOficial) {
    pontos = 5;
  }

  return pontos;
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