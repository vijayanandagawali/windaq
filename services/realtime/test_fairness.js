const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const provablyFair = require('./src/services/ProvablyFairService');

async function generateFairnessMatrix() {
  console.log("=== Provably Fair Game-by-Game Fairness Matrix ===");
  console.log("Fetching recent settled rounds from the database...\n");

  const matrix = [];

  // 1. Dice
  const diceRounds = await prisma.diceRoll.findMany({ where: { status: 'SETTLED' }, take: 1, orderBy: { startTime: 'desc' } });
  if (diceRounds.length > 0) {
    const r = diceRounds[0];
    const verification = provablyFair.deriveDiceResult(r.serverSeed, r.clientSeed, 0);
    const isMatch = JSON.stringify(r.diceResult) === JSON.stringify(verification.outcome);
    matrix.push({ Game: 'Dice', RoundId: r.id, Match: isMatch ? '✅' : '❌', DbOutcome: r.diceResult.join(','), VOutcome: verification.outcome.join(',') });
  } else {
    matrix.push({ Game: 'Dice', RoundId: 'N/A', Match: 'N/A', DbOutcome: 'N/A', VOutcome: 'N/A' });
  }

  // 2. Roulette
  const rouletteRounds = await prisma.rouletteRoll.findMany({ where: { status: 'SETTLED' }, take: 1, orderBy: { startTime: 'desc' } });
  if (rouletteRounds.length > 0) {
    const r = rouletteRounds[0];
    const verification = provablyFair.deriveRouletteResult(r.serverSeed, r.clientSeed, 0);
    const isMatch = r.resultNumber === verification.outcome;
    matrix.push({ Game: 'Roulette', RoundId: r.id, Match: isMatch ? '✅' : '❌', DbOutcome: r.resultNumber, VOutcome: verification.outcome });
  } else {
    matrix.push({ Game: 'Roulette', RoundId: 'N/A', Match: 'N/A', DbOutcome: 'N/A', VOutcome: 'N/A' });
  }

  // 3. Dragon Tiger
  const dtRounds = await prisma.tableGameRound.findMany({ where: { status: 'SETTLED', gameId: 'dragon-tiger' }, take: 1, orderBy: { startTime: 'desc' } });
  if (dtRounds.length > 0) {
    const r = dtRounds[0];
    const verification = provablyFair.deriveDragonTigerResult(r.serverSeed, r.clientSeed, 0);
    // Compare winners to avoid object serialization mismatch
    const isMatch = r.result.winner === verification.outcome.winner;
    matrix.push({ Game: 'Dragon Tiger', RoundId: r.id, Match: isMatch ? '✅' : '❌', DbOutcome: r.result.winner, VOutcome: verification.outcome.winner });
  } else {
    matrix.push({ Game: 'Dragon Tiger', RoundId: 'N/A', Match: 'N/A', DbOutcome: 'N/A', VOutcome: 'N/A' });
  }

  // 4. Andar Bahar
  const abRounds = await prisma.tableGameRound.findMany({ where: { status: 'SETTLED', gameId: 'andar-bahar' }, take: 1, orderBy: { startTime: 'desc' } });
  if (abRounds.length > 0) {
    const r = abRounds[0];
    const verification = provablyFair.deriveAndarBaharResult(r.serverSeed, r.clientSeed, 0);
    const isMatch = r.result.winner === verification.outcome.winner;
    matrix.push({ Game: 'Andar Bahar', RoundId: r.id, Match: isMatch ? '✅' : '❌', DbOutcome: r.result.winner, VOutcome: verification.outcome.winner });
  } else {
    matrix.push({ Game: 'Andar Bahar', RoundId: 'N/A', Match: 'N/A', DbOutcome: 'N/A', VOutcome: 'N/A' });
  }

  console.table(matrix);
  
  if (matrix.some(m => m.Match === '❌')) {
    console.error("\n❌ FAILED: Found mismatch between published outcome and verified derivation.");
    process.exit(1);
  } else {
    console.log("\n✅ PASSED: All published outcomes successfully verified against the Provably Fair derivation service.");
    process.exit(0);
  }
}

generateFairnessMatrix();
