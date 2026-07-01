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

    // ==========================================
    // 2️⃣ PONTOS DOS JOGADORES (CORRIGIDO 1-PARA-1)
    // ==========================================

    await pool.query(`
        WITH bet_ranked AS (
            SELECT id, aposta_id, jogador_nome,
                   ROW_NUMBER() OVER(PARTITION BY aposta_id, jogador_nome ORDER BY id) as rn
            FROM aposta_jogadores
        ),
        gols_ranked AS (
            SELECT jogo_id, jogador_nome,
                   ROW_NUMBER() OVER(PARTITION BY jogo_id, jogador_nome ORDER BY (SELECT 1)) as rn
            FROM gols_brasil
        )
        UPDATE aposta_jogadores aj
        SET pontos = 3
        FROM bet_ranked br
        JOIN apostas a ON a.id = br.aposta_id
        JOIN gols_ranked gr ON gr.jogo_id = a.jogo_id 
                           AND gr.jogador_nome = br.jogador_nome 
                           AND gr.rn = br.rn
        WHERE aj.id = br.id
    `);

    console.log("⚽ Pontos de jogadores atualizados com correspondência exata de gols");


// ========================================================
    // 3️⃣ PONTOS DOS PLACARES (SOMA EM MASSA - SEM LOOP)
    // ========================================================
    console.log("📊 Calculando pontos dos placares em massa...");

    await pool.query(`
        UPDATE apostas a
        SET pontos = (
            ROUND(
                -- 1. Cálculo dos Pontos Base do Placar
                (CASE 
                    -- Placar Exato (10 pontos)
                    WHEN a.gols_casa = j.gols_casa AND a.gols_fora = j.gols_fora THEN 10
                    
                    -- Acertou apenas o Resultado (Vencedor ou Empate)
                    WHEN (a.gols_casa > a.gols_fora AND j.gols_casa > j.gols_fora)
                      OR (a.gols_casa < a.gols_fora AND j.gols_casa < j.gols_fora)
                      OR (a.gols_casa = a.gols_fora AND j.gols_casa = j.gols_fora)
                    THEN
                        CASE 
                            WHEN j.gols_casa = j.gols_fora THEN 5 -- Acertou empate sem placar exato
                            WHEN ABS(a.gols_casa - a.gols_fora) = ABS(j.gols_casa - j.gols_fora) THEN 6 -- Acertou a diferença de gols
                            ELSE 4 -- Acertou só o vencedor
                        END
                    ELSE 0
                END) * -- 2. Multiplicador da Fase do Jogo
                (CASE 
                    WHEN j.id BETWEEN 73 AND 88 THEN 1.5   -- Pré-Oitavas
                    WHEN j.id BETWEEN 89 AND 96 THEN 2.0   -- Oitavas
                    WHEN j.id BETWEEN 97 AND 100 THEN 3.0  -- Quartas
                    WHEN j.id IN (101, 102) THEN 4.0       -- Semifinais
                    WHEN j.id IN (103, 104) THEN 5.0       -- Final e 3º Lugar
                    ELSE 1.0                               -- Grupos
                END) *
                
                -- 3. Multiplicador de Jogos do Brasil (Dobro de pontos)
                (CASE WHEN j.jogo LIKE '%Brasil%' THEN 2.0 ELSE 1.0 END)
            )::INTEGER
        ) + 
        
        -- 4. Pontos Extras de Classificação (Apenas para ID >= 73)
        (CASE 
            WHEN j.id >= 73 AND a.classificado_apostado = (
                CASE 
                    WHEN j.gols_casa > j.gols_fora THEN 'casa'
                    WHEN j.gols_fora > j.gols_casa THEN 'fora'
                    ELSE j.vencedor_penaltis
                END
            ) THEN 3
            ELSE 0
        END)
        FROM jogos j
        WHERE j.id = a.jogo_id
          AND j.gols_casa IS NOT NULL
          AND j.gols_fora IS NOT NULL;
    `);

    console.log("🎯 Pontos de placar (com multiplicador e classificado) atualizados com sucesso!");

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
        SET pontos = CASE 
            -- 🚨 SUPER BÔNUS: Se acertou os três nas posições exatas
            WHEN ap.primeiro_lugar = c.podio_1 
                 AND ap.segundo_lugar = c.podio_2 
                 AND ap.terceiro_lugar = c.podio_3 THEN 100
            ELSE 
                -- Soma individual de cada acerto
                (CASE WHEN ap.primeiro_lugar = c.podio_1 THEN 40 ELSE 0 END) +
                (CASE WHEN ap.segundo_lugar = c.podio_2 THEN 15 ELSE 0 END) +
                (CASE WHEN ap.terceiro_lugar = c.podio_3 THEN 5 ELSE 0 END)
        END
        FROM configuracoes c
    `);
    console.log("🏆 Pontos do pódio atualizados com as novas regras (40/15/5 ou 100)");

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