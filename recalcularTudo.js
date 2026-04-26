require("dotenv").config();
const pool = require("./db");

function obterMultiplicador(jogoId) {
    if (jogoId >= 73 && jogoId <= 88) return 1.5; // Pré-Oitavas (32 avos)
    if (jogoId >= 89 && jogoId <= 96) return 2.0; // Oitavas
    if (jogoId >= 97 && jogoId <= 100) return 3.0; // Quartas
    if (jogoId === 101 || jogoId === 102) return 4.0; // Semifinais
    if (jogoId === 103 || jogoId === 104) return 5.0; // Final e 3º Lugar
    return 1.0; // Grupos
}

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
    // 3️⃣ PONTOS DOS PLACARES (Substitua esta parte)
    // =========================

    const apostas = await pool.query(`
    SELECT 
        a.id,
        a.jogo_id,
        a.gols_casa,
        a.gols_fora,
        a.classificado_apostado, -- Garanta que essa coluna existe na tabela apostas
        j.gols_casa AS oficial_casa,
        j.gols_fora AS oficial_fora,
        j.vencedor_penaltis AS vencedor_penaltis_oficial -- Garanta que essa coluna existe na tabela jogos
    FROM apostas a
    JOIN jogos j ON j.id = a.jogo_id
    WHERE j.gols_casa IS NOT NULL
    AND j.gols_fora IS NOT NULL
    `);

    for (let aposta of apostas.rows) {
        let pontosBase = 0;
        let pontosExtras = 0;

        // 1. CÁLCULO DO PLACAR (Lógica de 10, 6, 4, 3)
        if (aposta.gols_casa === aposta.oficial_casa && aposta.gols_fora === aposta.oficial_fora) {
            pontosBase = 10;
        } else {
            const resAposta = aposta.gols_casa > aposta.gols_fora ? "casa" : aposta.gols_casa < aposta.gols_fora ? "fora" : "empate";
            const resOficial = aposta.oficial_casa > aposta.oficial_fora ? "casa" : aposta.oficial_casa < aposta.oficial_fora ? "fora" : "empate";

            if (resAposta === resOficial) {
                if (resOficial === "empate") {
                    pontosBase = 3;
                } else {
                    const diffAposta = Math.abs(aposta.gols_casa - aposta.gols_fora);
                    const diffOficial = Math.abs(aposta.oficial_casa - aposta.oficial_fora);
                    pontosBase = (diffAposta === diffOficial) ? 6 : 4;
                }
            }
        }

        // 2. APLICAR MULTIPLICADOR DO MATA-MATA
        const multiplicador = obterMultiplicador(aposta.jogo_id);
        let pontosFinaisPlacar = pontosBase * multiplicador;

        // 3. PONTOS EXTRAS (CLASSIFICADO) - Apenas ID >= 73
        if (aposta.jogo_id >= 73) {
            let classificadoOficial = "";
            if (aposta.oficial_casa > aposta.oficial_fora) {
                classificadoOficial = "casa";
            } else if (aposta.oficial_fora > aposta.oficial_casa) {
                classificadoOficial = "fora";
            } else {
                // Se foi empate, usa a coluna do vencedor dos pênaltis
                classificadoOficial = aposta.vencedor_penaltis_oficial; 
            }

            if (aposta.classificado_apostado === classificadoOficial) {
                pontosExtras = 3;
            }
        }

        const totalAposta = pontosFinaisPlacar + pontosExtras;

        // Atualiza a tabela de apostas com o total (Placar * Mult + Extra)
        await pool.query(`
            UPDATE apostas
            SET pontos = $1
            WHERE id = $2
        `, [totalAposta, aposta.id]);
    }

    console.log("🎯 Pontos de placar (com multiplicador e classificado) atualizados");

    // ... (continua o código para artilheiro, pódio e soma total)

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
    // 4.5️⃣ PONTOS DO PÓDIO
    // =========================
    await pool.query(`
        UPDATE apostas_podio ap
        SET pontos = 
            (CASE WHEN ap.primeiro_lugar = c.podio_1 THEN 10 ELSE 0 END) +
            (CASE WHEN ap.segundo_lugar = c.podio_2 THEN 10 ELSE 0 END) +
            (CASE WHEN ap.terceiro_lugar = c.podio_3 THEN 10 ELSE 0 END)
        FROM configuracoes c
    `);
    console.log("🏆 Pontos do pódio atualizados");

    // =========================
    // 5️⃣ SOMAR TUDO NO USUÁRIO
    // =========================

    await pool.query(`
    UPDATE usuarios
    SET pontos = subquery.total_geral
    FROM (
        SELECT 
            u.id AS user_id,
            (
                COALESCE(a.total, 0) + 
                COALESCE(j.total, 0) + 
                COALESCE(ar.total, 0) + 
                COALESCE(po.total, 0)
            ) AS total_geral
        FROM usuarios u
        LEFT JOIN (
            SELECT usuario_id, SUM(pontos) AS total 
            FROM apostas GROUP BY usuario_id
        ) a ON a.usuario_id = u.id
        LEFT JOIN (
            SELECT a.usuario_id, SUM(aj.pontos) AS total 
            FROM aposta_jogadores aj 
            JOIN apostas a ON a.id = aj.aposta_id GROUP BY a.usuario_id
        ) j ON j.usuario_id = u.id
        LEFT JOIN (
            SELECT usuario_id, SUM(pontos) AS total 
            FROM aposta_artilheiro GROUP BY usuario_id
        ) ar ON ar.usuario_id = u.id
        LEFT JOIN (
            SELECT usuario_id, pontos AS total 
            FROM apostas_podio
        ) po ON po.usuario_id = u.id
    ) AS subquery
    WHERE usuarios.id = subquery.user_id
    `);

    console.log("🏆 Ranking atualizado com sucesso!");

    console.log("\n✅ RECÁLCULO COMPLETO FINALIZADO");

  } catch (erro) {

    console.error("❌ ERRO:", erro);

  } finally {

    await pool.end();
    process.exit();

  }

}

recalcularTudo();