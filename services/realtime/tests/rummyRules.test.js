const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/services/cards/rummyRules');

let seq = 0;
const c = (rank, suit) => ({ id: `t${seq++}`, rank, suit });
const J = () => ({ id: `j${seq++}`, joker: true });
const WILD = 7; // 7s are wild in these tests unless stated

test('pure sequences: consecutive, one suit, ace low or high, no wrap, no stand-in jokers', () => {
  assert.ok(R.isPureSequence([c(1, 'H'), c(2, 'H'), c(3, 'H')]));
  assert.ok(R.isPureSequence([c(12, 'S'), c(13, 'S'), c(1, 'S')]));
  assert.ok(R.isPureSequence([c(6, 'D'), c(7, 'D'), c(8, 'D'), c(9, 'D')]), 'a wild 7 in its natural place keeps it pure');
  assert.ok(!R.isPureSequence([c(13, 'S'), c(1, 'S'), c(2, 'S')]), 'no wrap-around');
  assert.ok(!R.isPureSequence([c(4, 'H'), c(5, 'H'), c(6, 'S')]));
  assert.ok(!R.isPureSequence([c(4, 'H'), J(), c(6, 'H')]));
  assert.ok(!R.isPureSequence([c(4, 'H'), c(4, 'H'), c(5, 'H')]), 'duplicates from the second deck are not a run');
});

test('sequences with jokers, and sets', () => {
  assert.ok(R.isSequence([c(4, 'H'), J(), c(6, 'H')], WILD));
  assert.ok(R.isSequence([c(4, 'H'), c(7, 'C'), c(6, 'H')], WILD), 'a wild 7 of another suit fills the gap');
  assert.ok(R.isSequence([c(12, 'S'), J(), c(1, 'S')], WILD), 'Q-joker-A with ace high');
  assert.ok(!R.isSequence([J(), J(), c(7, 'C')], WILD), 'needs a real card');
  assert.ok(!R.isSequence([c(4, 'H'), J(), c(9, 'H')], WILD));

  assert.ok(R.isSet([c(9, 'S'), c(9, 'H'), c(9, 'D')], WILD));
  assert.ok(R.isSet([c(9, 'S'), c(9, 'H'), J(), c(9, 'C')], WILD));
  assert.ok(!R.isSet([c(9, 'S'), c(9, 'S'), c(9, 'D')], WILD), 'same suit twice (two decks) is not a set');
  assert.ok(!R.isSet([c(9, 'S'), c(9, 'H'), c(9, 'D'), c(9, 'C'), J()], WILD), 'at most four cards');
  assert.ok(!R.isSet([c(9, 'S'), c(10, 'H'), J()], WILD));
});

test('declaration validity and the three scoring cases', () => {
  const pure = [c(1, 'H'), c(2, 'H'), c(3, 'H')];
  const seq2 = [c(5, 'S'), c(6, 'S'), J()];
  const set = [c(9, 'S'), c(9, 'H'), c(9, 'D')];
  const set2 = [c(12, 'S'), c(12, 'H'), c(12, 'C'), c(12, 'D')];
  const good = R.scoreGroups([pure, seq2, set, set2], WILD);
  assert.deepEqual([good.valid, good.points], [true, 0]);

  // No pure sequence: every card counts (capped at 80).
  const noPure = R.scoreGroups([[c(5, 'S'), c(6, 'S'), J()], set, set2, [c(2, 'C'), c(4, 'D'), c(13, 'C')]], WILD);
  assert.equal(noPure.valid, false);
  assert.equal(noPure.points, Math.min(80, 5 + 6 + 0 + 27 + 40 + 2 + 4 + 10));

  // Pure sequence but no second sequence: sets still count.
  const onlyPure = R.scoreGroups([pure, set, set2, [c(2, 'C'), c(4, 'D'), c(13, 'C')]], WILD);
  assert.equal(onlyPure.points, Math.min(80, 27 + 40 + 16));
  const onlyPureSmall = R.scoreGroups([pure, set, [c(2, 'C'), c(4, 'D'), c(13, 'C'), c(5, 'H')], [c(3, 'S'), c(8, 'C'), c(6, 'D')]], WILD);
  assert.equal(onlyPureSmall.points, 27 + 2 + 4 + 10 + 5 + 3 + 8 + 6, 'a set does not count as melded without a second sequence');

  // Pure + second sequence: only the loose cards count.
  const nearly = R.scoreGroups([pure, seq2, set, [c(2, 'C'), c(4, 'D'), c(13, 'C'), c(11, 'S')]], WILD);
  assert.equal(nearly.points, 2 + 4 + 10 + 10);
});

test('solver finds a winning arrangement and the true minimum otherwise', () => {
  const hand = [c(1, 'H'), c(2, 'H'), c(3, 'H'), c(5, 'S'), c(6, 'S'), J(), c(9, 'S'), c(9, 'H'), c(9, 'D'), c(12, 'S'), c(12, 'H'), c(12, 'C'), c(12, 'D')];
  const best = R.bestArrangement(hand, WILD);
  assert.equal(best.points, 0);
  assert.equal(best.deadwood.length, 0);
  assert.equal(R.scoreGroups(best.groups, WILD).valid, true);

  // Remove the second sequence's joker: best is pure + (5,6 dead) with sets counted only if a 2nd seq exists.
  const hand2 = [c(1, 'H'), c(2, 'H'), c(3, 'H'), c(5, 'S'), c(6, 'S'), c(2, 'C'), c(9, 'S'), c(9, 'H'), c(9, 'D'), c(12, 'S'), c(12, 'H'), c(12, 'C'), c(12, 'D')];
  const b2 = R.bestArrangement(hand2, WILD);
  assert.equal(b2.points, 5 + 6 + 2 + 27 + 40 > 80 ? 80 : 5 + 6 + 2 + 27 + 40);

  // Solver result always matches scoring the groups it returns.
  const deck = R.buildShoe();
  for (let t = 0; t < 40; t++) {
    const h = [];
    for (let i = 0; i < 13; i++) h.push(deck[(t * 37 + i * 11) % deck.length]);
    const uniq = [...new Map(h.map((x) => [x.id, x])).values()];
    if (uniq.length !== 13) continue;
    const r = R.bestArrangement(uniq, 3);
    const scored = R.scoreGroups([...r.groups, ...(r.deadwood.length ? [r.deadwood] : [])], 3);
    assert.equal(scored.points, r.points, `hand ${t}`);
  }
});

test('display arrangement keeps every card once and pulls melds out even without a pure sequence', () => {
  const hand = [c(9, 'S'), c(10, 'S'), J(), c(5, 'D'), c(5, 'S'), c(5, 'H'), c(2, 'C'), c(13, 'D'), c(1, 'S'), c(3, 'D'), c(12, 'S'), c(4, 'H'), c(6, 'C')];
  const groups = R.displayArrangement(hand, WILD);
  assert.deepEqual(groups.flat().map((x) => x.id).sort(), hand.map((x) => x.id).sort());
  const kinds = groups.map((g) => R.classify(g, WILD)).filter(Boolean);
  assert.ok(kinds.length >= 2, 'the set of fives and the spade run are shown as melds');
});

test('shoe: 106 cards, unique ids', () => {
  const shoe = R.buildShoe();
  assert.equal(shoe.length, 106);
  assert.equal(new Set(shoe.map((x) => x.id)).size, 106);
});
