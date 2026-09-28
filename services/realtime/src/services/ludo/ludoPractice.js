/**
 * Ludo practice: the player (red) against 1 or 3 Computer opponents, free, no money.
 * Dice rolls come from an HMAC of a committed server seed and a roll counter (seed revealed at the
 * end), so no roll can be chosen after the fact. Games live in memory.
 */
const crypto = require('crypto');
const provablyFair = require('../ProvablyFairService');
const L = require('./ludoRules');
const { GameError } = require('../gameBets');

const IDLE_MS = 2 * 60 * 60 * 1000;
const games = new Map();
const byOwner = new Map();

function rollDie(game) {
  const next = provablyFair._makeIntStream(game.serverSeed, 'ludo-practice', game.rolls++);
  return next(6) + 1;
}

function newGame(owner, opponents) {
  const seats = opponents === 3 ? [0, 1, 2, 3] : [0, 2]; // one opponent sits opposite
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const game = {
    id: crypto.randomUUID(),
    owner,
    serverSeed,
    serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    rolls: 0,
    players: seats.map((seat, i) => ({ seat, kind: i === 0 ? 'you' : 'cpu', tokens: [-1, -1, -1, -1] })),
    current: 0,
    roll: null,
    sixes: 0,
    winner: null,
    updatedAt: Date.now()
  };
  games.set(game.id, game);
  byOwner.set(owner, game.id);
  return game;
}

function advanceTurn(game) {
  game.current = (game.current + 1) % game.players.length;
  game.sixes = 0;
  game.roll = null;
}

/**
 * Plays one roll for the current seat. With `chooser` (for the Computer) the move is picked here;
 * for the player, a roll with legal moves waits for a move.
 */
function rollFor(game, events, chooser) {
  const idx = game.current;
  const p = game.players[idx];
  const roll = rollDie(game);
  const ev = { seat: p.seat, kind: p.kind, roll };
  if (roll === 6) game.sixes += 1;
  if (game.sixes === 3) {
    events.push({ ...ev, forfeit: true });
    advanceTurn(game);
    return 'TURN_OVER';
  }
  const moves = L.legalMoves(p.tokens, roll);
  if (moves.length === 0) {
    events.push({ ...ev, noMove: true });
    if (roll === 6) { game.roll = null; return 'AGAIN'; }
    advanceTurn(game);
    return 'TURN_OVER';
  }
  if (!chooser) {
    game.roll = roll;
    events.push({ ...ev, awaiting: true, moves });
    return 'AWAIT_MOVE';
  }
  return applyAndContinue(game, events, idx, chooser(game.players, idx, roll), roll, ev);
}

function applyAndContinue(game, events, idx, token, roll, ev) {
  const r = L.applyMove(game.players, idx, token, roll);
  game.players = r.players;
  events.push({ ...ev, token, from: r.from, to: r.to, captured: r.captured, reachedHome: r.reachedHome });
  if (L.hasWon(game.players[idx].tokens)) {
    game.winner = game.players[idx].kind === 'you' ? 'you' : game.players[idx].seat;
    game.roll = null;
    return 'WON';
  }
  if (r.extraTurn && game.sixes < 3) { game.roll = null; return 'AGAIN'; }
  advanceTurn(game);
  return 'TURN_OVER';
}

/** Runs Computer turns until it is the player's turn again or the game ends. */
function runComputers(game, events) {
  let guard = 0;
  while (!game.winner && game.players[game.current].kind === 'cpu' && guard++ < 500) {
    const res = rollFor(game, events, L.chooseMove);
    if (res === 'WON') break;
  }
}

// ---------------------------------------------------------------- player API

function getOwned(owner, gameId) {
  const game = games.get(String(gameId || ''));
  if (!game || game.owner !== owner) throw new GameError('NOT_FOUND', 'Game not found. Start a new one.');
  game.updatedAt = Date.now();
  return game;
}

function start(owner, { opponents = 1, fresh = false } = {}) {
  const existing = byOwner.get(owner);
  if (!fresh && existing && games.get(existing) && !games.get(existing).winner) return games.get(existing);
  if (existing) games.delete(existing);
  return newGame(owner, Number(opponents) === 3 ? 3 : 1);
}

function roll(owner, gameId) {
  const game = getOwned(owner, gameId);
  if (game.winner) throw new GameError('GAME_OVER', 'This game is over.');
  if (game.players[game.current].kind !== 'you') throw new GameError('NOT_YOUR_TURN', 'Wait for your turn.');
  if (game.roll !== null) throw new GameError('MOVE_PENDING', 'Move a token first.');
  const events = [];
  const res = rollFor(game, events, null);
  if (res === 'TURN_OVER') runComputers(game, events);
  return { game, events };
}

function move(owner, gameId, token) {
  const game = getOwned(owner, gameId);
  if (game.winner) throw new GameError('GAME_OVER', 'This game is over.');
  const idx = game.current;
  const me = game.players[idx];
  if (me.kind !== 'you' || game.roll === null) throw new GameError('NOT_YOUR_TURN', 'Roll the die first.');
  const t = Number(token);
  if (!L.legalMoves(me.tokens, game.roll).includes(t)) throw new GameError('INVALID_MOVE', 'That token cannot move.');
  const events = [];
  const roll = game.roll;
  game.roll = null;
  const res = applyAndContinue(game, events, idx, t, roll, { seat: me.seat, kind: 'you', roll });
  if (res === 'TURN_OVER') runComputers(game, events);
  return { game, events };
}

function toPublic(game) {
  const me = game.players[game.current];
  return {
    id: game.id,
    players: game.players.map((p) => ({ seat: p.seat, kind: p.kind, tokens: p.tokens })),
    currentSeat: me.seat,
    yourTurn: !game.winner && me.kind === 'you',
    pendingRoll: game.roll,
    legalMoves: game.roll !== null ? L.legalMoves(me.tokens, game.roll) : [],
    winner: game.winner,
    serverSeedHash: game.serverSeedHash,
    serverSeed: game.winner !== null ? game.serverSeed : null
  };
}

function sweep(now = Date.now()) {
  for (const [id, g] of games) {
    if (now - g.updatedAt > IDLE_MS) {
      games.delete(id);
      if (byOwner.get(g.owner) === id) byOwner.delete(g.owner);
    }
  }
}

module.exports = { start, roll, move, toPublic, sweep, _games: games };
