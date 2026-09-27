const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const AviatorEngine = require('../src/services/aviatorEngine');
const { UNIVERSAL_PHASES } = require('../src/services/engine/UniversalRoundEngine');

function fakeIo() {
  const emitted = [];
  const target = { emit: (event, payload) => emitted.push({ event, payload }) };
  return { emitted, to: () => target, emit: (event, payload) => emitted.push({ event, payload }) };
}

function newEngine() {
  const engine = new AviatorEngine(fakeIo());
  engine.currentPhase = UNIVERSAL_PHASES.BETTING_OPEN;
  engine.isFlying = false;
  return engine;
}

function fly(engine, { multiplier, crashPoint }) {
  engine.currentPhase = UNIVERSAL_PHASES.BETTING_LOCKED;
  engine.isFlying = true;
  engine.multiplier = multiplier;
  engine.crashPoint = crashPoint;
}

test.before(async () => { await h.resetDb(); });
test.after(async () => { await h.prisma.$disconnect(); });

test('bet is debited through the ledger and cashout pays at the server multiplier', async () => {
  const user = await h.createUser({ balancePaise: 100000n }); // ₹1000
  const engine = newEngine();

  const bet = await engine.placeBet(user.id, { amount: 100, slot: 0 });
  assert.equal(bet.newBalance, 900);
  await h.assertLedgerMatchesWallet(assert, user.id);

  fly(engine, { multiplier: 2.347, crashPoint: 10 });
  // Anything the client might send besides the slot is ignored by design.
  const out = await engine.cashout(user.id, { slot: 0, winAmount: 999999, multiplier: 500 });
  assert.equal(out.multiplier, 2.34, 'multiplier is floored to 2 decimals, never rounded up');
  assert.equal(out.payout, 234);
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 113400n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('cashout is impossible before flight, after crash, or twice', async () => {
  const user = await h.createUser({ balancePaise: 50000n });
  const engine = newEngine();
  await engine.placeBet(user.id, { amount: 50 });

  await assert.rejects(engine.cashout(user.id, { slot: 0 }), { code: 'NOT_FLYING' });

  fly(engine, { multiplier: 1.5, crashPoint: 3 });
  const results = await Promise.allSettled([
    engine.cashout(user.id, { slot: 0 }),
    engine.cashout(user.id, { slot: 0 }),
    engine.cashout(user.id, { slot: 0 })
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'only one concurrent cashout may succeed');
  assert.equal((await h.getWallet(user.id)).balance, 50000n - 5000n + 7500n);

  const other = await h.createUser({ balancePaise: 50000n });
  const engine2 = newEngine();
  await engine2.placeBet(other.id, { amount: 50 });
  fly(engine2, { multiplier: 3.2, crashPoint: 3 });
  await assert.rejects(engine2.cashout(other.id, { slot: 0 }), { code: 'NOT_FLYING' });
  await h.assertLedgerMatchesWallet(assert, other.id);
});

test('cannot cash out someone else\'s bet or a non-existent bet', async () => {
  const owner = await h.createUser({ balancePaise: 50000n });
  const attacker = await h.createUser({ balancePaise: 0n });
  const engine = newEngine();
  await engine.placeBet(owner.id, { amount: 100 });
  fly(engine, { multiplier: 5, crashPoint: 50 });
  await assert.rejects(engine.cashout(attacker.id, { slot: 0 }), { code: 'NO_ACTIVE_BET' });
  assert.equal((await h.getWallet(attacker.id)).balance, 0n);
});

test('bet validation: window, limits, duplicates, insufficient funds', async () => {
  const user = await h.createUser({ balancePaise: 20000n }); // ₹200
  const engine = newEngine();

  await assert.rejects(engine.placeBet(user.id, { amount: 5 }), { code: 'INVALID_AMOUNT' });
  await assert.rejects(engine.placeBet(user.id, { amount: 10.001 }), { code: 'INVALID_AMOUNT' });
  await assert.rejects(engine.placeBet(user.id, { amount: 'abc' }), { code: 'INVALID_AMOUNT' });
  await assert.rejects(engine.placeBet(user.id, { amount: 100, slot: 5 }), { code: 'INVALID_SLOT' });
  await assert.rejects(engine.placeBet(user.id, { amount: 100, autoCashout: 0.5 }), { code: 'INVALID_AUTO_CASHOUT' });

  const concurrent = await Promise.allSettled([
    engine.placeBet(user.id, { amount: 100, slot: 0 }),
    engine.placeBet(user.id, { amount: 100, slot: 0 })
  ]);
  assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1, 'one bet per slot per round');

  await assert.rejects(engine.placeBet(user.id, { amount: 150, slot: 1 }), /Insufficient available balance/);
  assert.equal((await h.getWallet(user.id)).balance, 10000n);

  fly(engine, { multiplier: 1.2, crashPoint: 2 });
  await assert.rejects(engine.placeBet(user.id, { amount: 10, slot: 1 }), { code: 'BETTING_CLOSED' });
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('losing bets are settled from reserve to revenue at round end', async () => {
  const user = await h.createUser({ balancePaise: 30000n });
  const engine = newEngine();
  await engine.placeBet(user.id, { amount: 100 });
  const roundId = engine.roundId;
  fly(engine, { multiplier: 1.1, crashPoint: 1.1 });
  engine.isFlying = false;
  await engine.onSettlement(roundId, { crashPoint: 1.1 });

  const loss = await h.prisma.ledgerTransaction.findFirst({ where: { referenceId: AviatorEngine.betId(roundId, user.id, 0), referenceType: 'BET_LOSS' } });
  assert.ok(loss, 'loss moved out of the wager reserve');
  assert.equal((await h.getWallet(user.id)).balance, 20000n);

  // Settling twice is a no-op
  await engine.onSettlement(roundId, { crashPoint: 1.1 });
  assert.equal(await h.prisma.ledgerTransaction.count({ where: { referenceType: 'BET_LOSS', referenceId: AviatorEngine.betId(roundId, user.id, 0) } }), 1);
});

test('auto cashout pays the target even if a tick jumps past it into the crash', async () => {
  const user = await h.createUser({ balancePaise: 30000n });
  const engine = newEngine();
  await engine.placeBet(user.id, { amount: 100, autoCashout: 2 });
  fly(engine, { multiplier: 2.5, crashPoint: 2.01 });
  engine.processAutoCashouts(true);
  // allow the async settlement to complete
  for (let i = 0; i < 50 && engine.getUserBets(user.id)[0]?.status !== 'CASHED_OUT'; i++) await new Promise((r) => setTimeout(r, 20));
  const bet = engine.getUserBets(user.id)[0];
  assert.equal(bet.status, 'CASHED_OUT');
  assert.equal(bet.cashoutMultiplier, 2);
  assert.equal((await h.getWallet(user.id)).balance, 30000n - 10000n + 20000n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});
