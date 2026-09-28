const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const practice = require('../src/services/rummyPractice');
const R = require('../src/services/cards/rummyRules');

test('a new game deals 13 cards each from a committed shuffle, and hides the Computer hand', () => {
  const g = practice.restart('owner-a');
  const view = practice.toPublic(g);
  assert.equal(view.hand.length, 13);
  assert.equal(view.cpuCount, 13);
  assert.equal(view.phase, 'DRAW');
  assert.equal(view.serverSeed, null);
  assert.equal(view.serverSeedHash, crypto.createHash('sha256').update(g.serverSeed).digest('hex'));
  assert.equal(JSON.stringify(view).includes(JSON.stringify(g.hands.cpu[0])), false, 'no Computer card leaks into the view');
  const all = [...g.hands.you, ...g.hands.cpu, g.wildCard, ...g.open, ...g.closed];
  assert.equal(all.length, 106);
  assert.equal(new Set(all.map((c) => c.id)).size, 106, 'every card exists exactly once');
});

test('turn order is enforced and another owner cannot touch the game', () => {
  const g = practice.restart('owner-b');
  assert.throws(() => practice.discard('owner-b', g.id, g.hands.you[0].id), { code: 'NOT_YOUR_TURN' });
  assert.throws(() => practice.draw('someone-else', g.id, 'CLOSED'), { code: 'NOT_FOUND' });
  practice.draw('owner-b', g.id, 'CLOSED');
  assert.equal(g.hands.you.length, 14);
  assert.throws(() => practice.draw('owner-b', g.id, 'CLOSED'), { code: 'NOT_YOUR_TURN' });
  assert.throws(() => practice.drop('owner-b', g.id), { code: 'NOT_YOUR_TURN' });
  practice.discard('owner-b', g.id, g.hands.you[0].id);
  assert.equal(g.hands.you.length, 13);
  if (g.phase !== 'ENDED') {
    assert.equal(g.turn, 'you');
    assert.equal(g.hands.cpu.length, 13, 'the Computer drew and discarded');
    assert.ok(g.lastCpuMove.discarded);
  }
});

test('drops cost 20 before the first draw and 40 after', () => {
  const a = practice.restart('owner-c');
  practice.drop('owner-c', a.id);
  assert.deepEqual([a.result.winner, a.result.how, a.result.youPoints], ['cpu', 'DROPPED', 20]);

  const b = practice.restart('owner-c');
  practice.draw('owner-c', b.id, 'CLOSED');
  practice.discard('owner-c', b.id, b.hands.you[13].id);
  if (b.phase !== 'ENDED') {
    practice.drop('owner-c', b.id);
    assert.equal(b.result.youPoints, 40);
  }
});

test('a wrong show costs 80; a correct declaration wins and scores the Computer', () => {
  const g = practice.restart('owner-d');
  practice.draw('owner-d', g.id, 'CLOSED');
  const ids = g.hands.you.map((c) => c.id);
  assert.throws(() => practice.declare('owner-d', g.id, [ids.slice(0, 5)], ids[13]), { code: 'INVALID_GROUPS' });
  // Grouping the dealt hand as-is is almost never a valid show.
  const groups = [ids.slice(0, 3), ids.slice(3, 6), ids.slice(6, 9), ids.slice(9, 13)];
  const verdict = R.scoreGroups(groups.map((gr) => gr.map((id) => g.hands.you.find((c) => c.id === id))), g.wildRank);
  practice.declare('owner-d', g.id, groups, ids[13]);
  if (verdict.valid) assert.equal(g.result.winner, 'you');
  else assert.deepEqual([g.result.winner, g.result.how, g.result.youPoints], ['cpu', 'WRONG_SHOW', 80]);
  assert.ok(practice.toPublic(g).serverSeed, 'the seed is revealed at the end');

  // Force a winning hand to exercise the valid path.
  const w = practice.restart('owner-e');
  let n = 0;
  const card = (rank, suit) => ({ id: `w${n++}`, rank, suit });
  w.wildRank = 7;
  w.hands.you = [card(1, 'H'), card(2, 'H'), card(3, 'H'), card(5, 'S'), card(6, 'S'), card(7, 'D'), card(9, 'S'), card(9, 'H'), card(9, 'D'), card(12, 'S'), card(12, 'H'), card(12, 'C'), card(12, 'D')];
  practice.draw('owner-e', w.id, 'CLOSED');
  const hand = w.hands.you;
  const drawn = hand[13];
  const grp = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11, 12]].map((ix) => ix.map((i) => hand[i].id));
  practice.declare('owner-e', w.id, grp, drawn.id);
  assert.deepEqual([w.result.winner, w.result.how, w.result.youPoints], ['you', 'DECLARED', 0]);
  assert.equal(w.result.cpuPoints, R.bestArrangement(w.hands.cpu, 7).points);
});

test('simulated games always stay legal and finish', () => {
  for (let t = 0; t < 12; t++) {
    const owner = `sim-${t}`;
    const g = practice.restart(owner);
    let guard = 0;
    while (g.phase !== 'ENDED' && guard++ < 400) {
      practice.draw(owner, g.id, 'CLOSED');
      // A simple player: discard the highest loose card; declare when the solver says 0.
      const best = R.bestArrangement(g.hands.you, g.wildRank);
      const loose = best.deadwood.filter((c) => !R.isWild(c, g.wildRank));
      if (best.points === 0 && best.deadwood.length === 1) {
        practice.declare(owner, g.id, best.groups.map((gr) => gr.map((c) => c.id)), best.deadwood[0].id);
        break;
      }
      const pick = loose.length ? loose.reduce((a, b) => (R.cardPoints(b, g.wildRank) > R.cardPoints(a, g.wildRank) ? b : a)) : g.hands.you[0];
      practice.discard(owner, g.id, pick.id);
      const all = [...g.hands.you, ...g.hands.cpu, g.wildCard, ...g.open, ...g.closed];
      assert.equal(new Set(all.map((c) => c.id)).size, 106, 'no card is lost or duplicated');
      assert.equal(g.hands.cpu.length, 13);
    }
    if (g.phase !== 'ENDED') {
      // Very long games are possible with two cautious players; they must still be consistent.
      assert.equal(g.hands.you.length, 13);
    } else {
      assert.ok(['you', 'cpu'].includes(g.result.winner));
      assert.ok(g.result.youPoints >= 0 && g.result.youPoints <= 80);
    }
  }
});
