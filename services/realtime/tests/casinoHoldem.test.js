const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const h = require('./helpers');
const holdem = require('../src/services/casinoHoldem');
const { evaluate5, compare } = require('../src/services/cards/pokerHands');

const c = (...cards) => cards.map(([rank, suit]) => ({ rank, suit }));

test.before(async () => {
  await h.resetDb();
});

test.after(async () => {
  await h.prisma.$disconnect();
});

test('poker evaluator: all 2,598,960 five-card hands match the textbook counts', () => {
  const deck = [];
  for (const suit of 'SHDC') for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  const counts = {};
  for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let d = b + 1; d < 52; d++)
    for (let e = d + 1; e < 52; e++) for (let f = e + 1; f < 52; f++) {
      const k = evaluate5([deck[a], deck[b], deck[d], deck[e], deck[f]]).category;
      counts[k] = (counts[k] || 0) + 1;
    }
  assert.deepEqual(counts, { 1: 1302540, 2: 1098240, 3: 123552, 4: 54912, 5: 10200, 6: 5108, 7: 3744, 8: 624, 9: 36, 10: 4 });
  assert.ok(compare(c([14, 'S'], [2, 'H'], [3, 'D'], [4, 'C'], [5, 'S']), c([2, 'S'], [3, 'H'], [4, 'D'], [5, 'C'], [6, 'S'])) < 0, 'the wheel is the lowest straight');
});

test('outcomes: qualification, paytable, split and dealer win', () => {
  const ante = 10000n;
  const call = 20000n;
  const board = c([9, 'S'], [9, 'H'], [13, 'D'], [2, 'C'], [7, 'S']);

  // Dealer ace-high on a paired board = pair of 9s: qualifies. Player trips beats it.
  let r = holdem.resolveCalled({ ante, call, board, playerCards: c([9, 'D'], [3, 'C']), dealerCards: c([14, 'C'], [4, 'D']) });
  assert.equal(r.outcome, 'PLAYER_WINS');
  assert.equal(r.antePayout, ante * 2n, 'three of a kind pays 1:1 on the ante');
  assert.equal(r.callPayout, call * 2n);

  // Dealer with only a pair of threes (board has no pair) does not qualify: ante paid, call returned.
  const dry = c([12, 'S'], [8, 'H'], [5, 'D'], [2, 'C'], [10, 'S']);
  r = holdem.resolveCalled({ ante, call, board: dry, playerCards: c([6, 'D'], [4, 'C']), dealerCards: c([3, 'C'], [3, 'D']) });
  assert.equal(r.outcome, 'DEALER_NOT_QUALIFIED');
  assert.equal(r.antePayout, ante * 2n);
  assert.equal(r.callPayout, call);

  // Royal flush pays 100:1 on the ante.
  const royalBoard = c([10, 'H'], [11, 'H'], [12, 'H'], [2, 'C'], [2, 'D']);
  r = holdem.resolveCalled({ ante, call, board: royalBoard, playerCards: c([13, 'H'], [14, 'H']), dealerCards: c([4, 'S'], [4, 'D']) });
  assert.equal(r.antePayout, ante * 101n);

  // Both play the board: split, everything returned.
  const broadway = c([10, 'S'], [11, 'D'], [12, 'C'], [13, 'H'], [14, 'S']);
  r = holdem.resolveCalled({ ante, call, board: broadway, playerCards: c([2, 'D'], [3, 'C']), dealerCards: c([2, 'H'], [4, 'D']) });
  assert.equal(r.outcome, 'PUSH');
  assert.equal(r.antePayout + r.callPayout, ante + call);

  // Dealer's higher pair wins both bets.
  r = holdem.resolveCalled({ ante, call, board: dry, playerCards: c([6, 'D'], [6, 'C']), dealerCards: c([12, 'C'], [7, 'D']) });
  assert.equal(r.outcome, 'DEALER_WINS');
  assert.equal(r.antePayout + r.callPayout, 0n);
});

test('fold: the ante is lost once, the hand cannot be decided again, and hidden cards stay hidden while deciding', async () => {
  const user = await h.createUser({ balancePaise: 100000n });
  const hand = await holdem.dealHand(user.id, { ante: 100 });
  assert.equal((await h.getWallet(user.id)).balance, 90000n);

  const view = holdem.toPublic(hand);
  assert.equal(view.board.length, 3, 'only the flop is visible');
  assert.deepEqual(view.dealerCards, [{ hidden: true }, { hidden: true }]);
  assert.equal(view.serverSeed, null);
  assert.equal(view.serverSeedHash, crypto.createHash('sha256').update(hand.serverSeed).digest('hex'));

  await assert.rejects(holdem.dealHand(user.id, { ante: 100 }), { code: 'HAND_IN_PROGRESS' });
  const other = await h.createUser({ balancePaise: 100000n });
  await assert.rejects(holdem.decide(other.id, hand.id, 'FOLD'), { code: 'NOT_FOUND' });

  const folded = await holdem.decide(user.id, hand.id, 'FOLD');
  assert.equal(folded.status, 'FOLDED');
  await assert.rejects(holdem.decide(user.id, hand.id, 'CALL'), { code: 'ALREADY_DECIDED' });
  assert.equal((await h.getWallet(user.id)).balance, 90000n);
  assert.ok(holdem.toPublic(folded).serverSeed, 'the seed is revealed once the hand is over');
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('call: 2x ante is debited and the result settles exactly as computed', async () => {
  const user = await h.createUser({ balancePaise: 100000n });
  const hand = await holdem.dealHand(user.id, { ante: 100, clientSeed: 'my-seed' });
  const expected = holdem.resolveCalled({ ...hand, call: 20000n });
  const settled = await holdem.decide(user.id, hand.id, 'CALL');
  assert.equal(settled.status, 'SETTLED');
  assert.equal(settled.payout, expected.antePayout + expected.callPayout);
  assert.equal((await h.getWallet(user.id)).balance, 100000n - 30000n + expected.antePayout + expected.callPayout);
  const view = holdem.toPublic(settled);
  assert.equal(view.board.length, 5);
  assert.deepEqual(holdem.deal(view.serverSeed, 'my-seed'), { playerCards: hand.playerCards, dealerCards: hand.dealerCards, board: hand.board }, 'the revealed seed reproduces the deal');
  await assert.rejects(holdem.decide(user.id, hand.id, 'CALL'), { code: 'ALREADY_DECIDED' });
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('a call the player cannot afford changes nothing; the hand can still be folded', async () => {
  const user = await h.createUser({ balancePaise: 10000n });
  const hand = await holdem.dealHand(user.id, { ante: 100 });
  await assert.rejects(holdem.decide(user.id, hand.id, 'CALL'), /Insufficient available balance/);
  const after = await h.prisma.casinoHoldemHand.findUnique({ where: { id: hand.id } });
  assert.equal(after.status, 'DECIDING');
  assert.equal(after.call, 0n);
  assert.equal((await h.getWallet(user.id)).balance, 0n);
  await holdem.decide(user.id, hand.id, 'FOLD');
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('undecided hands are folded after the timeout; invalid antes are refused', async () => {
  const user = await h.createUser({ balancePaise: 100000n });
  const hand = await holdem.dealHand(user.id, { ante: 50 });
  await h.prisma.casinoHoldemHand.update({ where: { id: hand.id }, data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) } });
  assert.equal(await holdem.expireStale(), 1);
  const after = await h.prisma.casinoHoldemHand.findUnique({ where: { id: hand.id } });
  assert.equal(after.status, 'FOLDED');
  assert.equal(after.result.outcome, 'TIMED_OUT');
  await h.assertLedgerMatchesWallet(assert, user.id);

  for (const ante of [0, -10, 5, 10001, 'abc', 10.555]) {
    await assert.rejects(holdem.dealHand(user.id, { ante }), { code: 'INVALID_AMOUNT' }, String(ante));
  }
});
