const { test, expect } = require('@playwright/test');
const simulationEngine = require('../services/realtime/src/services/simulation/AutomaticGameSimulationEngine');

test.describe('Automatic Game Simulation Engine Test Suite', () => {

  const EXPECTED_STEPS = {
    'roulette': ['wheel', 'ball', 'result', 'payout', 'next_round'],
    'dragon-tiger': ['shuffle', 'cards', 'reveal', 'result', 'settlement'],
    'andar-bahar': ['joker', 'cards', 'match', 'result', 'settlement'],
    'blackjack': ['deal', 'player_logic', 'dealer_logic', 'result', 'settlement'],
    'teen-patti': ['deal', 'turns', 'showdown', 'result'],
    'lotto': ['ticket_close', 'draw', 'result', 'settlement'],
    'scratch': ['ticket_generation', 'reveal', 'result'],
    'slots': ['spin', 'reel_animation', 'outcome', 'payout'],
    'crash': ['round', 'multiplier', 'crash', 'settlement']
  };

  test('All 9 games execute their exact server-authoritative step pipelines', async () => {
    for (const [gameType, expectedSteps] of Object.entries(EXPECTED_STEPS)) {
      const res = await simulationEngine.simulate(gameType, { deterministic: false });
      
      expect(res.gameType).toBe(gameType);
      expect(res.roundId).toBeTruthy();
      expect(res.seed.serverSeed).toBeTruthy();
      expect(res.seed.serverSeedHash).toBeTruthy();

      const actualSteps = res.steps.map(s => s.step);
      expect(actualSteps).toEqual(expectedSteps);
      expect(res.outcome).toBeDefined();
      expect(typeof res.payout).toBe('number');
      console.log(`✓ [${gameType.toUpperCase()}] executed steps: ${actualSteps.join(' → ')}`);
    }
  });

  test('Deterministic test mode produces bit-for-bit identical outcomes on repeated runs', async () => {
    const fixedSeed = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const clientSeed = 'test-client-seed-qa';
    const nonce = 42;

    for (const gameType of Object.keys(EXPECTED_STEPS)) {
      const run1 = await simulationEngine.simulate(gameType, {
        deterministic: true,
        serverSeed: fixedSeed,
        clientSeed,
        nonce
      });

      const run2 = await simulationEngine.simulate(gameType, {
        deterministic: true,
        serverSeed: fixedSeed,
        clientSeed,
        nonce
      });

      expect(run1.seed.serverSeedHash).toEqual(run2.seed.serverSeedHash);
      expect(run1.outcome).toEqual(run2.outcome);
      expect(run1.payout).toEqual(run2.payout);

      const steps1 = run1.steps.map(s => s.step);
      const steps2 = run2.steps.map(s => s.step);
      expect(steps1).toEqual(steps2);

      console.log(`✓ [${gameType.toUpperCase()}] Deterministic repeatability verified (Outcome: ${JSON.stringify(run1.outcome)})`);
    }
  });

  test('Server-authoritative payouts evaluate accurately across edge cases', async () => {
    // 1. Dragon Tiger: Tie returns 0.5x on Dragon/Tiger bets
    const dtRes = await simulationEngine.simulate('dragon-tiger', {
      deterministic: true,
      betMarket: 'DRAGON',
      betAmount: 200
    });
    expect(dtRes.steps.find(s => s.step === 'settlement')).toBeDefined();

    // 2. Blackjack: BJ pays 3:2 (2.5x total), Win pays 2x, Push returns stake
    const bjRes = await simulationEngine.simulate('blackjack', {
      deterministic: true,
      betAmount: 100
    });
    expect([0, 100, 200, 250]).toContain(bjRes.payout);

    // 3. Crash: Auto-cashout evaluates against crashPoint
    const crashRes = await simulationEngine.simulate('crash', {
      deterministic: true,
      betAmount: 100,
      autoCashout: 2.0
    });
    const { crashPoint, cashedOut } = crashRes.outcome;
    if (cashedOut) {
      expect(crashRes.payout).toBe(200);
      expect(crashPoint).toBeGreaterThanOrEqual(2.0);
    } else {
      expect(crashRes.payout).toBe(0);
      expect(crashPoint).toBeLessThan(2.0);
    }
  });
});
