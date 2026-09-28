/**
 * Standard poker hand ranking (best 5 of up to 7 cards), shared by Casino Hold'em and the
 * multiplayer Texas Hold'em tables.
 *
 * Cards are { suit: 'S'|'H'|'D'|'C', rank: 2..14 } (J=11, Q=12, K=13, A=14).
 * `score` arrays compare element by element; the first element is the category.
 */

const CATEGORY = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
  ROYAL_FLUSH: 10
};

const CATEGORY_NAME = {
  1: 'High Card',
  2: 'Pair',
  3: 'Two Pair',
  4: 'Three of a Kind',
  5: 'Straight',
  6: 'Flush',
  7: 'Full House',
  8: 'Four of a Kind',
  9: 'Straight Flush',
  10: 'Royal Flush'
};

const RANK_NAME = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const PLURAL = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
const rankLabel = (r) => RANK_NAME[r] || String(r);

/** Top card of a straight in 5 distinct sorted-desc ranks, or 0. The wheel A-2-3-4-5 counts as 5-high. */
function straightTop(desc) {
  if (desc[0] - desc[4] === 4 && new Set(desc).size === 5) return desc[0];
  if (desc[0] === 14 && desc[1] === 5 && desc[2] === 4 && desc[3] === 3 && desc[4] === 2) return 5;
  return 0;
}

function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Evaluates exactly five cards. */
function evaluate5(cards) {
  const desc = cards.map((c) => c.rank).sort((x, y) => y - x);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const top = straightTop(desc);

  // Group ranks by count, then by rank (e.g. full house: [trip, pair]).
  const counts = new Map();
  for (const r of desc) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join('');
  const byGroup = groups.map((g) => g[0]);

  if (top && flush) return { category: top === 14 ? CATEGORY.ROYAL_FLUSH : CATEGORY.STRAIGHT_FLUSH, score: [top === 14 ? 10 : 9, top], cards };
  if (shape === '41') return { category: CATEGORY.FOUR_OF_A_KIND, score: [8, ...byGroup], cards };
  if (shape === '32') return { category: CATEGORY.FULL_HOUSE, score: [7, ...byGroup], cards };
  if (flush) return { category: CATEGORY.FLUSH, score: [6, ...desc], cards };
  if (top) return { category: CATEGORY.STRAIGHT, score: [5, top], cards };
  if (shape === '311') return { category: CATEGORY.THREE_OF_A_KIND, score: [4, ...byGroup], cards };
  if (shape === '221') return { category: CATEGORY.TWO_PAIR, score: [3, ...byGroup], cards };
  if (shape === '2111') return { category: CATEGORY.PAIR, score: [2, ...byGroup], cards };
  return { category: CATEGORY.HIGH_CARD, score: [1, ...desc], cards };
}

function describe(result) {
  const s = result.score;
  switch (result.category) {
    case CATEGORY.ROYAL_FLUSH: return 'Royal Flush';
    case CATEGORY.STRAIGHT_FLUSH: return `Straight Flush, ${rankLabel(s[1])} high`;
    case CATEGORY.FOUR_OF_A_KIND: return `Four ${PLURAL[s[1]]}`;
    case CATEGORY.FULL_HOUSE: return `Full House, ${PLURAL[s[1]]} over ${PLURAL[s[2]]}`;
    case CATEGORY.FLUSH: return `Flush, ${rankLabel(s[1])} high`;
    case CATEGORY.STRAIGHT: return `Straight, ${rankLabel(s[1])} high`;
    case CATEGORY.THREE_OF_A_KIND: return `Three ${PLURAL[s[1]]}`;
    case CATEGORY.TWO_PAIR: return `Two Pair, ${PLURAL[s[1]]} and ${PLURAL[s[2]]}`;
    case CATEGORY.PAIR: return `Pair of ${PLURAL[s[1]]}`;
    default: return `${rankLabel(s[1])} high`;
  }
}

/** Best five-card hand from 5 to 7 cards. */
function evaluate(cards) {
  if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) throw new Error('Poker hands use 5 to 7 cards');
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const r = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (!best || compareScores(r.score, best.score) > 0) best = r;
    }
  return { ...best, name: CATEGORY_NAME[best.category], label: describe(best) };
}

/** >0 if cards a beat cards b, <0 if b wins, 0 for a split. */
function compare(a, b) {
  return compareScores(evaluate(a).score, evaluate(b).score);
}

module.exports = { CATEGORY, CATEGORY_NAME, evaluate, evaluate5, compare, compareScores, rankLabel };
