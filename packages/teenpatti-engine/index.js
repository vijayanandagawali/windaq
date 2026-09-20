const crypto = require('crypto');

const SUITS = ['S', 'H', 'D', 'C'];
// 2 to 14 (Ace = 14)
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

class Deck {
  constructor() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ suit, rank });
      }
    }
  }

  shuffle() {
    // Fisher-Yates with crypto for fairness
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(num) {
    if (this.cards.length < num) throw new Error("Not enough cards");
    return this.cards.splice(0, num);
  }
}

/**
 * Ranks a 3-card hand in Teen Patti.
 * Returns an object with:
 * - type: The hand type (e.g. 'TRAIL', 'PURE_SEQ')
 * - score: A numeric score that can be directly compared against other hands.
 */
function evaluateHand(cards) {
  if (!cards || cards.length !== 3) throw new Error("Must provide exactly 3 cards");

  // Sort descending by rank
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const r1 = sorted[0].rank;
  const r2 = sorted[1].rank;
  const r3 = sorted[2].rank;

  const isFlush = (sorted[0].suit === sorted[1].suit) && (sorted[1].suit === sorted[2].suit);
  
  // Check sequence (including A-2-3 exception where A=14, 2=2, 3=3 -> sorted: 14, 3, 2)
  let isSeq = false;
  let seqHigh = 0;
  if (r1 === r2 + 1 && r2 === r3 + 1) {
    isSeq = true;
    seqHigh = r1;
  } else if (r1 === 14 && r2 === 3 && r3 === 2) { // A, 3, 2 (lowest straight, high card is 3)
    isSeq = true;
    seqHigh = 3;
  }

  // Calculate base kickers for tie-breaking
  const tieBreaker = (r1 * 10000) + (r2 * 100) + r3;

  // 1. Trail (Three of a Kind)
  if (r1 === r2 && r2 === r3) {
    return { type: 'TRAIL', score: 60000000 + r1 };
  }

  // 2. Pure Sequence (Straight Flush)
  if (isSeq && isFlush) {
    return { type: 'PURE_SEQ', score: 50000000 + seqHigh };
  }

  // 3. Sequence (Straight)
  if (isSeq) {
    return { type: 'SEQ', score: 40000000 + seqHigh };
  }

  // 4. Color (Flush)
  if (isFlush) {
    return { type: 'COLOR', score: 30000000 + tieBreaker };
  }

  // 5. Pair
  if (r1 === r2 || r2 === r3) {
    const pairRank = (r1 === r2) ? r1 : r2;
    const kicker = (r1 === r2) ? r3 : r1;
    return { type: 'PAIR', score: 20000000 + (pairRank * 100) + kicker };
  }

  // 6. High Card
  return { type: 'HIGH_CARD', score: 10000000 + tieBreaker };
}

/**
 * Returns the winning hand(s). 
 * Can return multiple if it's an exact tie.
 */
function findWinners(playerHands) {
  let winners = [];
  let maxScore = -1;

  for (const ph of playerHands) {
    const evaluation = evaluateHand(ph.cards);
    if (evaluation.score > maxScore) {
      maxScore = evaluation.score;
      winners = [{ ...ph, ...evaluation }];
    } else if (evaluation.score === maxScore) {
      winners.push({ ...ph, ...evaluation });
    }
  }

  return winners;
}

/**
 * Formats a card to short string, e.g. {suit: 'S', rank: 14} -> 'AS'
 */
function formatCard(card) {
  const map = {14: 'A', 13: 'K', 12: 'Q', 11: 'J'};
  const r = map[card.rank] || card.rank;
  return `${r}${card.suit}`;
}

module.exports = {
  Deck,
  evaluateHand,
  findWinners,
  formatCard
};
