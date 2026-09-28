const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { debitStake, settleBet, refundBet } = require('../src/services/gameBets');

let http;

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

async function stake(userId, game, betId, paise) {
  await h.prisma.$transaction((tx) => debitStake(tx, userId, paise, game, betId));
}

test('game history reports each bet and today totals straight from the ledger, per player', async () => {
  const player = await h.createUser({ balancePaise: 100000n });
  const other = await h.createUser({ balancePaise: 100000n });

  await stake(player.id, 'dice', 'dice-win', 10000n);
  await settleBet(player.id, 10000n, 19500n, 'dice', 'dice-win');
  await stake(player.id, 'dice', 'dice-loss', 5000n);
  await settleBet(player.id, 5000n, 0n, 'dice', 'dice-loss');
  await stake(player.id, 'dice', 'dice-void', 2000n);
  await refundBet(player.id, 2000n, 'dice', 'dice-void');
  await stake(player.id, 'dice', 'dice-open', 1000n);
  // Another game and another player must not leak into this history.
  await stake(player.id, 'colour', 'colour-1', 3000n);
  await stake(other.id, 'dice', 'other-dice', 4000n);

  const res = await http.request('GET', '/api/ledger/game-history?game=dice', { token: h.tokenFor(player) });
  assert.equal(res.status, 200);
  const { bets, today } = res.body.data;
  const byId = Object.fromEntries(bets.map((b) => [b.id, b]));

  assert.deepEqual(Object.keys(byId).sort(), ['dice-loss', 'dice-open', 'dice-void', 'dice-win']);
  assert.deepEqual(
    { status: byId['dice-win'].status, stake: byId['dice-win'].stake, payout: byId['dice-win'].payout, net: byId['dice-win'].net },
    { status: 'WON', stake: 100, payout: 195, net: 95 }
  );
  assert.equal(byId['dice-loss'].status, 'LOST');
  assert.equal(byId['dice-loss'].net, -50);
  assert.equal(byId['dice-void'].status, 'REFUNDED');
  assert.equal(byId['dice-void'].net, 0);
  assert.equal(byId['dice-open'].status, 'PENDING');
  assert.equal(byId['dice-open'].net, null);

  // Pending bets are not counted until they settle.
  assert.deepEqual(today, { bets: 3, wins: 1, staked: 170, paid: 215, net: 45 });

  const colour = await http.request('GET', '/api/ledger/game-history?game=color-prediction', { token: h.tokenFor(player) });
  assert.deepEqual(colour.body.data.bets.map((b) => b.id), ['colour-1']);
});

test('game history requires a session and a known game', async () => {
  const player = await h.createUser({ balancePaise: 0n });
  assert.equal((await http.request('GET', '/api/ledger/game-history?game=dice')).status, 401);
  const bad = await http.request('GET', '/api/ledger/game-history?game=../../etc', { token: h.tokenFor(player) });
  assert.equal(bad.status, 400);
});
