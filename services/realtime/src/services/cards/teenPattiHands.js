/**
 * Teen Patti (3-card) hand ranking, shared by the house 20-20 table and multiplayer tables.
 *
 * Cards are { suit: 'S'|'H'|'D'|'C', rank: 2..14 } (J=11, Q=12, K=13, A=14).
 * Categories, highest first: TRAIL (three of a kind) > PURE_SEQUENCE (straight flush) >
 * SEQUENCE (straight) > COLOR (flush) > PAIR > HIGH_CARD.
 * Sequences: A-K-Q is the highest, A-2-3 the second highest, then K-Q-J down to 4-3-2.
 */

const CATEGORY = {
  HIGH_CARD: 1,
  PAIR: 2,
  COLOR: 3,
  SEQUENCE: 4,
  PURE_SEQUENCE: 5,
  TRAIL: 6
};

const CATEGORY_NAME = {
  1: 'High Card',
  2: 'Pair',
  3: 'Color',
  4: 'Sequence',
  5: 'Pure Sequence',
  6: 'Trail'
};

const RANK_NAME = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const rankLabel = (r) => RANK_NAME[r] || String(r);

/**
 * Sequence strength for sorted-descending ranks, or 0 if not a sequence.
 * A-K-Q = 15 (highest), A-2-3 = 14.5, otherwise the top card (K-Q-J = 13 ... 4-3-2 = 4).
 */
function sequenceStrength(desc) {
  const [a, b, c] = desc;
  if (a === 14 && b === 13 && c === 12) return 15;
  if (a === 14 && b === 3 && c === 2) return 14.5;
  if (a - b === 1 && b - c === 1) return a;
  return 0;
}

/**
 * Evaluates a 3-card hand. `score` is an array compared element by element (higher wins).
 */
function evaluate(cards) {
  if (!Array.isArray(cards) || cards.length !== 3) throw new Error('A Teen Patti hand has exactly 3 cards');
  const desc = cards.map((c) => c.rank).sort((x, y) => y - x);
  const flush = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;
  const seq = sequenceStrength(desc);

  let category;
  let score;
  if (desc[0] === desc[1] && desc[1] === desc[2]) {
    category = CATEGORY.TRAIL;
    score = [desc[0]];
  } else if (seq && flush) {
    category = CATEGORY.PURE_SEQUENCE;
    score = [seq];
  } else if (seq) {
    category = CATEGORY.SEQUENCE;
    score = [seq];
  } else if (flush) {
    category = CATEGORY.COLOR;
    score = desc;
  } else if (desc[0] === desc[1] || desc[1] === desc[2]) {
    category = CATEGORY.PAIR;
    const pair = desc[1];
    const kicker = desc[0] === desc[1] ? desc[2] : desc[0];
    score = [pair, kicker];
  } else {
    category = CATEGORY.HIGH_CARD;
    score = desc;
  }

  return { category, name: CATEGORY_NAME[category], score: [category, ...score], label: describe(category, desc) };
}

function describe(category, desc) {
  switch (category) {
    case CATEGORY.TRAIL: return `Trail of ${rankLabel(desc[0])}s`;
    case CATEGORY.PURE_SEQUENCE: return `Pure Sequence ${desc.map(rankLabel).join('-')}`;
    case CATEGORY.SEQUENCE: return `Sequence ${desc.map(rankLabel).join('-')}`;
    case CATEGORY.COLOR: return `Color, ${rankLabel(desc[0])} high`;
    case CATEGORY.PAIR: return `Pair of ${rankLabel(desc[1])}s`;
    default: return `${rankLabel(desc[0])} high`;
  }
}

/** Returns >0 if hand a beats hand b, <0 if b wins, 0 for an exact tie. */
function compare(a, b) {
  const sa = evaluate(a).score;
  const sb = evaluate(b).score;
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    const d = (sa[i] || 0) - (sb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

module.exports = { CATEGORY, CATEGORY_NAME, evaluate, compare, rankLabel };
