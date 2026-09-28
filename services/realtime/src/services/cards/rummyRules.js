/**
 * Indian 13-card (Points) Rummy rules: meld validation, declaration check, scoring and an exact
 * best-arrangement solver. Shared by the practice table and the multiplayer tables.
 *
 * Cards: { id, suit: 'S'|'H'|'D'|'C', rank: 1..13 } (A=1, J=11, Q=12, K=13) or a printed joker
 * { id, joker: true }. Two decks are in play, so the same suit and rank can appear twice (distinct ids).
 * `wildRank` (1..13): every card of that rank is a joker too.
 *
 * Melds:
 *   Pure sequence   3+ consecutive cards of one suit, no joker standing in (a wild-rank card in its
 *                   natural place is fine). A can be low (A-2-3) or high (Q-K-A); no wrap (K-A-2).
 *   Sequence        3+ consecutive cards of one suit, jokers may fill gaps; at least one real card.
 *   Set             3 or 4 cards of one rank in different suits, jokers may fill; at least one real card.
 * Valid declaration: all 13 cards in melds, at least two sequences, at least one of them pure.
 * Points (lower is better, capped at 80): A/K/Q/J = 10, number cards face value, jokers 0.
 *   no pure sequence           -> every card counts
 *   pure sequence, no second   -> only cards in pure sequences are exempt
 *   pure + another sequence    -> every card in a valid meld is exempt
 */

const MAX_POINTS = 80;
const FIRST_DROP = 20;
const MIDDLE_DROP = 40;

const isPrintedJoker = (c) => !!c && c.joker === true;
const isWild = (c, wildRank) => isPrintedJoker(c) || c.rank === wildRank;

function cardPoints(c, wildRank) {
  if (isWild(c, wildRank)) return 0;
  return c.rank === 1 || c.rank >= 11 ? 10 : c.rank;
}

/** Can these distinct ranks (1..13) plus `jokers` wildcards fill a consecutive run of `len` cards? */
function fitsRun(ranks, jokers, len) {
  const tryRanks = (rs) => {
    const sorted = [...rs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) return false;
    const span = sorted[sorted.length - 1] - sorted[0] + 1;
    if (span > len) return false;
    const gaps = span - sorted.length;
    // Remaining jokers extend the run at either end; the run must stay inside A..K (or 2..A-high).
    return gaps <= jokers && len <= 13;
  };
  if (ranks.length === 0) return false;
  if (tryRanks(ranks)) return true;
  // Ace high: treat A as 14 (only meaningful when an ace is present).
  if (ranks.includes(1)) return tryRanks(ranks.map((r) => (r === 1 ? 14 : r)));
  return false;
}

function isPureSequence(cards) {
  if (cards.length < 3 || cards.some(isPrintedJoker)) return false;
  const suit = cards[0].suit;
  if (cards.some((c) => c.suit !== suit)) return false;
  return fitsRun(cards.map((c) => c.rank), 0, cards.length);
}

function isSequence(cards, wildRank) {
  if (cards.length < 3) return false;
  if (isPureSequence(cards)) return true;
  const naturals = cards.filter((c) => !isWild(c, wildRank));
  if (naturals.length === 0) return false;
  const suit = naturals[0].suit;
  if (naturals.some((c) => c.suit !== suit)) return false;
  return fitsRun(naturals.map((c) => c.rank), cards.length - naturals.length, cards.length);
}

function isSet(cards, wildRank) {
  if (cards.length < 3 || cards.length > 4) return false;
  const naturals = cards.filter((c) => !isWild(c, wildRank));
  if (naturals.length === 0) {
    // All wild: valid only if they are all the same natural rank in different suits (e.g. 7S 7H 7D with 7s wild).
    const real = cards.filter((c) => !isPrintedJoker(c));
    if (real.length !== cards.length) return false;
    return new Set(real.map((c) => c.rank)).size === 1 && new Set(real.map((c) => c.suit)).size === real.length;
  }
  const rank = naturals[0].rank;
  if (naturals.some((c) => c.rank !== rank)) return false;
  return new Set(naturals.map((c) => c.suit)).size === naturals.length;
}

/** Classifies one group: 'PURE_SEQUENCE' | 'SEQUENCE' | 'SET' | null (not a meld). */
function classify(cards, wildRank) {
  if (isPureSequence(cards)) return 'PURE_SEQUENCE';
  if (isSequence(cards, wildRank)) return 'SEQUENCE';
  if (isSet(cards, wildRank)) return 'SET';
  return null;
}

/**
 * Scores a player's own grouping (as submitted). Returns { valid, points, groups:[{kind}] }.
 * `valid` means a correct declaration (points 0).
 */
function scoreGroups(groups, wildRank) {
  const kinds = groups.map((g) => classify(g, wildRank));
  const pure = kinds.filter((k) => k === 'PURE_SEQUENCE').length;
  const seqs = kinds.filter((k) => k === 'PURE_SEQUENCE' || k === 'SEQUENCE').length;
  const all = groups.flat();
  const total = all.reduce((s, c) => s + cardPoints(c, wildRank), 0);
  let points;
  if (pure === 0) points = total;
  else if (seqs < 2) points = groups.reduce((s, g, i) => (kinds[i] === 'PURE_SEQUENCE' ? s : s + g.reduce((a, c) => a + cardPoints(c, wildRank), 0)), 0);
  else points = groups.reduce((s, g, i) => (kinds[i] ? s : s + g.reduce((a, c) => a + cardPoints(c, wildRank), 0)), 0);
  const valid = all.length === 13 && pure >= 1 && seqs >= 2 && kinds.every(Boolean);
  return { valid, points: valid ? 0 : Math.min(MAX_POINTS, points), kinds };
}

/**
 * Exact best arrangement of a hand (up to 14 cards) under the scoring rules above.
 * Returns { points, groups: Card[][] (melds), deadwood: Card[] }.
 */
function bestArrangement(hand, wildRank) {
  const n = hand.length;
  if (n > 14) throw new Error('Hand too large');
  const pts = hand.map((c) => cardPoints(c, wildRank));
  const full = (1 << n) - 1;
  const sumMask = (mask) => { let s = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) s += pts[i]; return s; };

  // Every subset of 3+ cards that is a meld, bucketed by its lowest card index.
  const melds = []; // { mask, kind }
  for (let mask = 1; mask <= full; mask++) {
    let bits = 0; for (let m = mask; m; m &= m - 1) bits++;
    if (bits < 3) continue;
    const cards = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) cards.push(hand[i]);
    const kind = classify(cards, wildRank);
    if (kind) melds.push({ mask, kind });
  }
  const byLow = Array.from({ length: n }, () => []);
  for (const m of melds) byLow[31 - Math.clz32(m.mask & -m.mask)].push(m);

  // Regime A: needs >=1 pure sequence and >=2 sequences; deadwood = uncovered points.
  // State: remaining mask, hasPure (0/1), sequences (0,1,2+). Value: min deadwood, or Infinity.
  const memoA = new Map();
  const solveA = (mask, hasPure, seqs) => {
    if (mask === 0) return hasPure && seqs >= 2 ? { cost: 0, pick: null } : { cost: Infinity, pick: null };
    const key = mask * 6 + hasPure * 3 + seqs;
    const hit = memoA.get(key);
    if (hit) return hit;
    const low = 31 - Math.clz32(mask & -mask);
    const lowBit = 1 << low;
    // Leave the lowest card as deadwood.
    const rest = solveA(mask & ~lowBit, hasPure, seqs);
    let best = { cost: rest.cost + pts[low], pick: { dead: low } };
    for (const m of byLow[low]) {
      if ((m.mask & mask) !== m.mask) continue;
      const isSeq = m.kind !== 'SET';
      const r = solveA(mask & ~m.mask, hasPure || m.kind === 'PURE_SEQUENCE' ? 1 : 0, Math.min(2, seqs + (isSeq ? 1 : 0)));
      if (r.cost < best.cost) best = { cost: r.cost, pick: { meld: m } };
    }
    memoA.set(key, best);
    return best;
  };

  // Regime B: only pure sequences are exempt; maximise points covered by disjoint pure sequences.
  const pureMelds = melds.filter((m) => m.kind === 'PURE_SEQUENCE');
  const memoB = new Map();
  const solveB = (mask) => {
    if (mask === 0) return { cost: 0, picks: [] };
    const hit = memoB.get(mask);
    if (hit) return hit;
    const low = 31 - Math.clz32(mask & -mask);
    const lowBit = 1 << low;
    const rest = solveB(mask & ~lowBit);
    let best = { cost: rest.cost + pts[low], picks: rest.picks };
    for (const m of pureMelds) {
      if (!(m.mask & lowBit) || (m.mask & mask) !== m.mask) continue;
      const r = solveB(mask & ~m.mask);
      if (r.cost < best.cost) best = { cost: r.cost, picks: [m, ...r.picks] };
    }
    memoB.set(mask, best);
    return best;
  };

  const toCards = (mask) => hand.filter((_, i) => mask & (1 << i));
  const total = sumMask(full);

  const a = solveA(full, 0, 0);
  const b = solveB(full);
  const hasAnyPure = pureMelds.length > 0;

  if (a.cost < Infinity && a.cost <= (hasAnyPure ? b.cost : total)) {
    const groups = [];
    const deadwood = [];
    let mask = full; let hasPure = 0; let seqs = 0;
    while (mask) {
      const step = solveA(mask, hasPure, seqs).pick;
      if (step.dead !== undefined) { deadwood.push(hand[step.dead]); mask &= ~(1 << step.dead); continue; }
      groups.push(toCards(step.meld.mask));
      if (step.meld.kind === 'PURE_SEQUENCE') hasPure = 1;
      if (step.meld.kind !== 'SET') seqs = Math.min(2, seqs + 1);
      mask &= ~step.meld.mask;
    }
    return { points: Math.min(MAX_POINTS, a.cost), groups, deadwood };
  }
  if (hasAnyPure && b.cost < total) {
    const used = b.picks.reduce((m, p) => m | p.mask, 0);
    return { points: Math.min(MAX_POINTS, b.cost), groups: b.picks.map((p) => toCards(p.mask)), deadwood: toCards(full & ~used) };
  }
  return { points: Math.min(MAX_POINTS, total), groups: [], deadwood: [...hand] };
}

/**
 * Arrangement for showing a hand to the player (the "Sort" button): as many cards in melds as
 * possible even before a pure sequence exists, then the loose cards grouped by suit in rank order,
 * jokers on their own. Scoring always uses bestArrangement/scoreGroups, never this.
 */
function displayArrangement(hand, wildRank) {
  const n = hand.length;
  const pts = hand.map((c) => cardPoints(c, wildRank) + 1); // +1: prefer covering more cards on ties
  const full = (1 << n) - 1;
  const melds = [];
  for (let mask = 1; mask <= full; mask++) {
    let bits = 0; for (let m = mask; m; m &= m - 1) bits++;
    if (bits < 3) continue;
    const cards = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) cards.push(hand[i]);
    const kind = classify(cards, wildRank);
    if (kind) melds.push({ mask, kind });
  }
  const memo = new Map();
  const solve = (mask) => {
    if (mask === 0) return { cost: 0, picks: [] };
    const hit = memo.get(mask);
    if (hit) return hit;
    const low = 31 - Math.clz32(mask & -mask);
    const rest = solve(mask & ~(1 << low));
    let best = { cost: rest.cost + pts[low], picks: rest.picks };
    for (const m of melds) {
      if (!(m.mask & (1 << low)) || (m.mask & mask) !== m.mask) continue;
      const r = solve(mask & ~m.mask);
      // Pure sequences first on ties, so the most valuable meld is kept.
      if (r.cost < best.cost) best = { cost: r.cost, picks: [m, ...r.picks] };
    }
    memo.set(mask, best);
    return best;
  };
  const { picks } = solve(full);
  const order = { PURE_SEQUENCE: 0, SEQUENCE: 1, SET: 2 };
  const used = picks.reduce((m, p) => m | p.mask, 0);
  const groups = picks.sort((a, b) => order[a.kind] - order[b.kind]).map((p) => hand.filter((_, i) => p.mask & (1 << i)));
  const loose = hand.filter((_, i) => !(used & (1 << i)));
  const jokers = loose.filter((c) => isWild(c, wildRank));
  for (const suit of ['S', 'H', 'D', 'C']) {
    const g = loose.filter((c) => !isWild(c, wildRank) && c.suit === suit).sort((a, b) => a.rank - b.rank);
    if (g.length) groups.push(g);
  }
  if (jokers.length) groups.push(jokers);
  return groups;
}

/** Builds the 106-card shoe: two decks plus two printed jokers, each card with a unique id. */
function buildShoe() {
  const cards = [];
  for (let d = 0; d < 2; d++) {
    for (const suit of ['S', 'H', 'D', 'C']) for (let rank = 1; rank <= 13; rank++) cards.push({ id: `${d}${suit}${rank}`, suit, rank });
    cards.push({ id: `${d}JK`, joker: true });
  }
  return cards;
}

module.exports = {
  MAX_POINTS,
  FIRST_DROP,
  MIDDLE_DROP,
  isWild,
  isPrintedJoker,
  cardPoints,
  isPureSequence,
  isSequence,
  isSet,
  classify,
  scoreGroups,
  bestArrangement,
  displayArrangement,
  buildShoe
};
