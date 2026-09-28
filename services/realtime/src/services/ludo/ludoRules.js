/**
 * Classic Ludo rules (pure functions), shared by practice games and future multiplayer tables.
 *
 * Seats: 0 red, 1 green, 2 yellow, 3 blue, each starting 13 squares apart on a 52-square track.
 * Token position (relative to its own seat):
 *   -1        in base
 *   0..50     on the main track (0 = own start square)
 *   51..55    own home column
 *   56        home (finished)
 * A 6 brings a token out to 0. Moves need an exact roll to reach 56. Landing on a square held by
 * opponents captures them (back to base) unless it is a safe square: the four start squares and
 * the four stars. A 6, a capture or reaching home earns another roll; a third 6 in a row ends the
 * turn with no move.
 */

const TRACK = 52;
const HOME = 56;
const START_OFFSET = [0, 13, 26, 39];
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Absolute track square (0..51) for a relative position on the main track, or null off-track. */
function absSquare(seat, rel) {
  if (rel < 0 || rel > 50) return null;
  return (START_OFFSET[seat] + rel) % TRACK;
}

/** Target position for moving a token by `roll`, or null if the move is not allowed. */
function target(pos, roll) {
  if (pos === HOME) return null;
  if (pos === -1) return roll === 6 ? 0 : null;
  const next = pos + roll;
  return next > HOME ? null : next;
}

/** Tokens (indices 0..3) that can move with this roll. */
function legalMoves(tokens, roll) {
  const out = [];
  tokens.forEach((pos, i) => { if (target(pos, roll) !== null) out.push(i); });
  return out;
}

/**
 * Applies a move. `players` is an array of { seat, tokens: number[4] } (not mutated).
 * Returns { players, from, to, captured: [{ seat, token }], reachedHome, extraTurn }.
 */
function applyMove(players, seatIndex, tokenIndex, roll) {
  const next = players.map((p) => ({ ...p, tokens: [...p.tokens] }));
  const me = next[seatIndex];
  const from = me.tokens[tokenIndex];
  const to = target(from, roll);
  if (to === null) throw new Error('Illegal move');
  me.tokens[tokenIndex] = to;

  const captured = [];
  const sq = absSquare(me.seat, to);
  if (sq !== null && !SAFE_SQUARES.has(sq)) {
    next.forEach((p, pi) => {
      if (pi === seatIndex) return;
      p.tokens.forEach((pos, ti) => {
        if (absSquare(p.seat, pos) === sq) {
          p.tokens[ti] = -1;
          captured.push({ seat: p.seat, token: ti });
        }
      });
    });
  }
  const reachedHome = to === HOME;
  return { players: next, from, to, captured, reachedHome, extraTurn: roll === 6 || captured.length > 0 || reachedHome };
}

const hasWon = (tokens) => tokens.every((t) => t === HOME);

/**
 * Computer move choice, a transparent heuristic: capture > reach home > leave a square where it can
 * be hit > bring a token out > enter the home column > advance the leading safe token.
 */
function chooseMove(players, seatIndex, roll) {
  const me = players[seatIndex];
  const options = legalMoves(me.tokens, roll);
  if (options.length === 0) return null;

  const threatened = (seat, pos) => {
    const sq = absSquare(seat, pos);
    if (sq === null || SAFE_SQUARES.has(sq)) return false;
    return players.some((p, pi) => pi !== seatIndex && p.tokens.some((op) => {
      const osq = absSquare(p.seat, op);
      if (osq === null) return false;
      const dist = (sq - osq + TRACK) % TRACK;
      return dist >= 1 && dist <= 6;
    }));
  };

  let best = null;
  for (const t of options) {
    const r = applyMove(players, seatIndex, t, roll);
    const from = me.tokens[t];
    let score = 0;
    score += r.captured.length * 100;
    if (r.reachedHome) score += 80;
    if (from >= 0 && from <= 50 && threatened(me.seat, from)) score += 40;
    if (from === -1) score += 30;
    if (r.to >= 51 && from <= 50) score += 25;
    if (r.to <= 50 && threatened(me.seat, r.to)) score -= 35;
    const sq = absSquare(me.seat, r.to);
    if (sq !== null && SAFE_SQUARES.has(sq)) score += 10;
    score += r.to / 10;
    if (!best || score > best.score) best = { token: t, score };
  }
  return best.token;
}

module.exports = { TRACK, HOME, START_OFFSET, SAFE_SQUARES, absSquare, target, legalMoves, applyMove, hasWon, chooseMove };
