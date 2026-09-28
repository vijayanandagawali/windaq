/**
 * Server-side European roulette bet validation.
 *
 * The numbers a bet covers are never trusted from the client: outside bets are derived from the
 * market alone, and inside bets must match real table geometry. A bet whose targets do not match
 * its market is rejected (e.g. a "STRAIGHT" bet covering 37 numbers).
 */
const { GameError } = require('./gameBets');

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const ALL = range(1, 36);

// Net odds (x:1). Total return on a win = stake * (odds + 1).
const ODDS = { STRAIGHT: 35, SPLIT: 17, STREET: 11, CORNER: 8, LINE: 5, COLUMN: 2, DOZEN: 2, RED: 1, BLACK: 1, EVEN: 1, ODD: 1, HIGH: 1, LOW: 1 };

// Fixed outside bets: the market alone determines the numbers.
const FIXED = {
  RED: RED_NUMBERS,
  BLACK: ALL.filter(n => !RED_NUMBERS.includes(n)),
  EVEN: ALL.filter(n => n % 2 === 0),
  ODD: ALL.filter(n => n % 2 === 1),
  LOW: range(1, 18),
  HIGH: range(19, 36)
};

const DOZENS = [range(1, 12), range(13, 24), range(25, 36)];
const COLUMNS = [1, 2, 3].map(c => ALL.filter(n => n % 3 === c % 3));

const sameSet = (a, b) => a.length === b.length && a.every((n, i) => n === b[i]);

function normalizeTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0 || targets.length > 18) {
    throw new GameError('INVALID_BET', 'Invalid roulette selection.');
  }
  const nums = targets.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 36) || new Set(nums).size !== nums.length) {
    throw new GameError('INVALID_BET', 'Invalid roulette selection.');
  }
  return nums.sort((a, b) => a - b);
}

function isSplit([a, b]) {
  if (a === 0) return [1, 2, 3].includes(b);
  return (b - a === 1 && a % 3 !== 0) || b - a === 3;
}

function isStreet(t) {
  if (t[0] === 0) return sameSet(t, [0, 1, 2]) || sameSet(t, [0, 2, 3]);
  return t[0] % 3 === 1 && sameSet(t, [t[0], t[0] + 1, t[0] + 2]);
}

function isCorner(t) {
  if (t[0] === 0) return sameSet(t, [0, 1, 2, 3]);
  const n = t[0];
  return n % 3 !== 0 && n <= 32 && sameSet(t, [n, n + 1, n + 3, n + 4]);
}

function isLine(t) {
  const n = t[0];
  return n % 3 === 1 && n <= 31 && sameSet(t, range(n, n + 5));
}

/**
 * Validates a roulette bet and returns the canonical { market, targets, odds }.
 */
function validateRouletteBet(market, targets) {
  const m = String(market || '').toUpperCase();
  if (!(m in ODDS)) throw new GameError('INVALID_BET', 'Unknown roulette market.');

  if (FIXED[m]) return { market: m, targets: FIXED[m], odds: ODDS[m] };

  const t = normalizeTargets(targets);
  const valid =
    (m === 'STRAIGHT' && t.length === 1) ||
    (m === 'SPLIT' && t.length === 2 && isSplit(t)) ||
    (m === 'STREET' && t.length === 3 && isStreet(t)) ||
    (m === 'CORNER' && t.length === 4 && isCorner(t)) ||
    (m === 'LINE' && t.length === 6 && isLine(t)) ||
    (m === 'DOZEN' && DOZENS.some(d => sameSet(t, d))) ||
    (m === 'COLUMN' && COLUMNS.some(c => sameSet(t, c)));

  if (!valid) throw new GameError('INVALID_BET', 'Those numbers do not form a valid bet for this market.');
  return { market: m, targets: t, odds: ODDS[m] };
}

module.exports = { validateRouletteBet, ODDS, RED_NUMBERS };
