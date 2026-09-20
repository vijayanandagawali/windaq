#!/usr/bin/env node

const simulationEngine = require('../services/realtime/src/services/simulation/AutomaticGameSimulationEngine');

const ALL_GAMES = [
  'roulette',
  'dragon-tiger',
  'andar-bahar',
  'blackjack',
  'teen-patti',
  'lotto',
  'scratch',
  'slots',
  'crash'
];

async function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const isDeterministic = args.includes('--deterministic');
  const gameIndex = args.indexOf('--game');
  const targetGame = gameIndex !== -1 ? args[gameIndex + 1] : null;

  console.log('================================================================');
  console.log('       WINDAQ AUTOMATIC GAME SIMULATION ENGINE RUNNER           ');
  console.log('================================================================');
  console.log(`Deterministic Mode: ${isDeterministic ? 'ENABLED (Fixed Seed)' : 'DISABLED (Live RNG)'}`);
  console.log('----------------------------------------------------------------\n');

  const gamesToRun = isAll ? ALL_GAMES : (targetGame ? [targetGame] : ALL_GAMES);

  for (const game of gamesToRun) {
    console.log(`▶ Running Simulation: [${game.toUpperCase()}]`);
    try {
      const simResult = await simulationEngine.simulate(game, {
        deterministic: isDeterministic
      });

      console.log(`  Round ID:   ${simResult.roundId}`);
      console.log(`  Seed Hash:  ${simResult.seed.serverSeedHash.substring(0, 16)}...`);
      console.log(`  Duration:   ${simResult.durationMs}ms`);
      console.log(`  Payout:     ₹${simResult.payout}`);
      console.log('  Steps:');
      simResult.steps.forEach((s, idx) => {
        const payloadStr = JSON.stringify(s.payload);
        const truncated = payloadStr.length > 70 ? payloadStr.substring(0, 67) + '...' : payloadStr;
        console.log(`    [${idx + 1}] ${s.step.padEnd(16)} -> ${truncated}`);
      });
      console.log(`  Outcome:    ${JSON.stringify(simResult.outcome)}\n`);
    } catch (err) {
      console.error(`  ❌ Error simulating ${game}:`, err.message, '\n');
    }
  }

  console.log('================================================================');
  console.log('                  ALL SIMULATIONS COMPLETED                     ');
  console.log('================================================================');
}

main().catch(console.error);
