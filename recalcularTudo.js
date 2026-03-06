require("dotenv").config();
const pool = require("./db");

async function recalcularTudo() {

  try {

    console.log("🚀 Recalculando tudo...");

    // =========================
    // 1️⃣ ZERAR PONTOS
    // =========================

    await pool.query(`UPDATE apostas SET pontos = 0`);
    await pool.query(`UPDATE aposta_jogadores SET pontos = 0`);
    await pool.query(`UPDATE aposta_artilheiro SET pontos = 0`);
    await pool.query(`UPDATE usuarios SET pontos = 0`);

    console.log("🧹 Pontos zerados");

    // =========================
    // 2️⃣ PONTOS DOS JOGADORES
    // =========================

    await pool.query(`
        UPDATE aposta_jogadores aj
        SET pontos = 3
        FROM apostas a, gols_brasil g
        WHERE aj.aposta_id = a.id
        AND g.jogo_id = a.jogo_id
        AND g.jogador_nome = aj.jogador_nome
    `);

    console.log("⚽ Pontos de jogadores atualizados");

    // =========================
    // 3️⃣ PONTOS DOS PLACARES
    // =========================

    const apostas = await pool.query(`
    SELECT 
        a.id,
        a.gols_casa,
        a.gols_fora,
        j.gols_casa AS oficial_casa,
        j.gols_fora AS oficial_fora
    FROM apostas a
    JOIN jogos j ON j.id = a.jogo_id
    WHERE j.gols_casa IS NOT NULL
    AND j.gols_fora IS NOT NULL
    `);

    for (let aposta of apostas.rows) {

      let pontos = 0;

      if (
        aposta.gols_casa === aposta.oficial_casa &&
        aposta.gols_fora === aposta.oficial_fora
      ) {
        pontos = 10;
      } else {

        const resAposta =
          aposta.gols_casa > aposta.gols_fora ? "casa" :
          aposta.gols_casa < aposta.gols_fora ? "fora" :
          "empate";

        const resOficial =
          aposta.oficial_casa > aposta.oficial_fora ? "casa" :
          aposta.oficial_casa < aposta.oficial_fora ? "fora" :
          "empate";

        if (resAposta === resOficial) {

          if (resOficial === "empate") {
            pontos = 3;
          } else {

            const diffAposta = Math.abs(aposta.gols_casa - aposta.gols_fora);
            const diffOficial = Math.abs(aposta.oficial_casa - aposta.oficial_fora);

            if (diffAposta === diffOficial) {
              pontos = 6;
            } else {
              pontos = 4;
            }
          }
        }
      }

      await pool.query(`
        UPDATE apostas
        SET pontos = $1
        WHERE id = $2
      `, [pontos, aposta.id]);
    }

    console.log("🎯 Pontos de placar atualizados");

    // =========================
    // 4️⃣ PONTOS ARTILHEIRO
    // =========================

    await pool.query(`
      UPDATE aposta_artilheiro aa
      SET pontos =
      CASE
        WHEN aa.tipo = 'inicial' THEN 25
        WHEN aa.tipo = 'pos_grupos' THEN 15
        ELSE 0
      END
      FROM configuracoes c
      WHERE aa.jogador = c.artilheiro_oficial
    `);

    console.log("🥅 Pontos de artilheiro atualizados");

    // =========================
    // 5️⃣ SOMAR TUDO NO USUÁRIO
    // =========================

    await pool.query(`
    UPDATE usuarios u
    SET pontos =
        COALESCE(a.total,0) +
        COALESCE(j.total,0) +
        COALESCE(ar.total,0)
    FROM
    (
        SELECT usuario_id, SUM(pontos) AS total
        FROM apostas
        GROUP BY usuario_id
    ) a
    LEFT JOIN
    (
        SELECT a.usuario_id, SUM(aj.pontos) AS total
        FROM aposta_jogadores aj
        JOIN apostas a ON a.id = aj.aposta_id
        GROUP BY a.usuario_id
    ) j ON j.usuario_id = a.usuario_id
    LEFT JOIN
    (
        SELECT usuario_id, SUM(pontos) AS total
        FROM aposta_artilheiro
        GROUP BY usuario_id
    ) ar ON ar.usuario_id = a.usuario_id
    WHERE u.id = a.usuario_id
    `);

    console.log("🏆 Ranking atualizado");

    console.log("\n✅ RECÁLCULO COMPLETO FINALIZADO");

  } catch (erro) {

    console.error("❌ ERRO:", erro);

  } finally {

    await pool.end();
    process.exit();

  }

}

recalcularTudo();