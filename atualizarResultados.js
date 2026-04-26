const pool = require("./db");

async function atualizar() {
  try {
    // Exemplo: Jogo 1 terminou 1x1 e o time de FORA venceu nos pênaltis
    const golsCasa = 1;
    const golsFora = 1;
    const jogoId = 1;
    
    // Define o vencedor dos pênaltis apenas se houver empate
    // Se não for empate, pode ser null
    const vencedorPenaltis = (golsCasa === golsFora) ? "fora" : null;

    await pool.query(
      `
      UPDATE jogos
      SET gols_casa = $1,
          gols_fora = $2,
          vencedor_penaltis = $3
      WHERE id = $4
      `,
      [golsCasa, golsFora, vencedorPenaltis, jogoId]
    );

    console.log(`✅ Jogo ${jogoId} atualizado: ${golsCasa}x${golsFora} (Vencedor Penaltis: ${vencedorPenaltis})`);
  } catch (err) {
    console.error("❌ Erro ao atualizar:", err);
  } finally {
    process.exit();
  }
}

atualizar();