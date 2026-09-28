const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, compare } = require('../src/services/cards/teenPattiHands');

const hand = (...cards) => cards.map(([rank, suit]) => ({ rank, suit }));
const DECK = [];
for (const suit of 'SHDC') for (let rank = 2; rank <= 14; rank++) DECK.push({ rank, suit });

test('all 22,100 three-card hands fall into the textbook category counts', () => {
  const counts = {};
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) for (let k = j + 1; k < 52; k++) {
    const { name } = evaluate([DECK[i], DECK[j], DECK[k]]);
    counts[name] = (counts[name] || 0) + 1;
  }
  assert.deepEqual(counts, { 'High Card': 16440, Pair: 3744, Color: 1096, Sequence: 720, 'Pure Sequence': 48, Trail: 52 });
});

test('category order and tie-breaks follow Indian Teen Patti rules', () => {
  const beats = (a, b) => assert.ok(compare(a, b) > 0 && compare(b, a) < 0);
  beats(hand([2, 'S'], [2, 'H'], [2, 'D']), hand([14, 'S'], [13, 'S'], [12, 'S'])); // trail > pure sequence
  beats(hand([4, 'S'], [3, 'S'], [2, 'S']), hand([14, 'S'], [13, 'H'], [12, 'D'])); // pure seq > sequence
  beats(hand([4, 'S'], [3, 'H'], [2, 'D']), hand([14, 'S'], [13, 'S'], [9, 'S'])); // sequence > color
  beats(hand([5, 'S'], [3, 'S'], [2, 'S']), hand([14, 'S'], [14, 'H'], [13, 'D'])); // color > pair
  beats(hand([2, 'S'], [2, 'H'], [3, 'D']), hand([14, 'S'], [13, 'H'], [11, 'D'])); // pair > high card
  beats(hand([14, 'S'], [13, 'H'], [12, 'D']), hand([14, 'C'], [2, 'H'], [3, 'D'])); // A-K-Q highest sequence
  beats(hand([14, 'C'], [2, 'H'], [3, 'D']), hand([13, 'S'], [12, 'H'], [11, 'D'])); // A-2-3 second
  beats(hand([9, 'S'], [9, 'H'], [5, 'D']), hand([9, 'C'], [9, 'D'], [4, 'D'])); // pair kicker
  beats(hand([14, 'S'], [10, 'H'], [6, 'D']), hand([14, 'C'], [10, 'D'], [5, 'H'])); // high card, third card
  assert.equal(compare(hand([14, 'S'], [10, 'H'], [5, 'D']), hand([14, 'C'], [10, 'D'], [5, 'H'])), 0);
});
