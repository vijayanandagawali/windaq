/**
 * Rummy practice: 13-card Points Rummy, one player against the Computer, for free (no money).
 * The server holds the shoe and the Computer's hand; the client only ever sees its own cards.
 *
 * The shoe (two decks + two printed jokers) is shuffled from a server seed whose SHA-256 is shown
 * at the start and which is revealed when the game ends. Games live in memory: a restart ends
 * any practice game in progress (nothing of value is lost, there is no money here).
 */
const crypto = require('crypto');
const provablyFair = require('./ProvablyFairService');
const R = require('./cards/rummyRules');
const { GameError } = require('./gameBets');

const IDLE_MS = 2 * 60 * 60 * 1000;
const games = new Map();   // gameId -> game
const byOwner = new Map(); // owner -> gameId

function shuffle(cards, serverSeed, nonce) {
  const next = provablyFair._makeIntStream(serverSeed, 'rummy-practice', nonce);
  const d = [...cards];
  for (let i = d.length - 1; i > 0; i--) {
    const j = next(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function newGame(owner) {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const shoe = shuffle(R.buildShoe(), serverSeed, 0);
  const you = shoe.splice(0, 13);
  const cpu = shoe.splice(0, 13);
  const wildCard = shoe.shift();
  // A printed joker turned as the wild card makes aces wild (standard table rule).
  const wildRank = wildCard.joker ? 1 : wildCard.rank;
  const open = [shoe.shift()];
  const game = {
    id: crypto.randomUUID(),
    owner,
    serverSeed,
    serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
    reshuffles: 0,
    closed: shoe,
    open,
    wildCard,
    wildRank,
    hands: { you, cpu },
    turn: 'you',
    phase: 'DRAW',
    playerTurns: 0,
    lastCpuMove: null,
    result: null,
    updatedAt: Date.now()
  };
  games.set(game.id, game);
  byOwner.set(owner, game.id);
  return game;
}

function drawClosed(game) {
  if (game.closed.length === 0) {
    // Re-form the closed deck from the open pile, keeping its top card.
    const top = game.open.pop();
    game.reshuffles += 1;
    game.closed = shuffle(game.open, game.serverSeed, game.reshuffles);
    game.open = top ? [top] : [];
  }
  return game.closed.shift();
}

const pointsOf = (hand, wildRank) => R.bestArrangement(hand, wildRank).points;

function endGame(game, winner, how, extra = {}) {
  game.phase = 'ENDED';
  game.turn = null;
  const youBest = R.bestArrangement(game.hands.you.slice(0, 13), game.wildRank);
  const cpuBest = R.bestArrangement(game.hands.cpu.slice(0, 13), game.wildRank);
  let youPoints = 0;
  let cpuPoints = 0;
  if (winner === 'you') cpuPoints = cpuBest.points;
  else youPoints = extra.youPoints ?? youBest.points;
  game.result = {
    winner,
    how, // DECLARED | WRONG_SHOW | DROPPED | COMPUTER_DECLARED
    youPoints,
    cpuPoints,
    cpuGroups: cpuBest.groups,
    cpuDeadwood: cpuBest.deadwood,
    cpuHand: game.hands.cpu
  };
}

/** The Computer's turn: take the open card only if it joins a meld, discard its worst loose card, declare at 0. */
function computerTurn(game) {
  const { wildRank } = game;
  const hand = game.hands.cpu;
  const top = game.open[game.open.length - 1];
  let source = 'CLOSED';
  let drawn;
  // Jokers on the open pile cannot be taken; the Computer never sees the player's cards.
  if (top && !R.isWild(top, wildRank)) {
    const withTop = R.bestArrangement([...hand, top], wildRank);
    const inMeld = withTop.groups.some((g) => g.some((x) => x.id === top.id));
    if (inMeld && withTop.points < pointsOf(hand, wildRank)) {
      source = 'OPEN';
      drawn = game.open.pop();
    }
  }
  if (!drawn) drawn = drawClosed(game);
  hand.push(drawn);

  // Choose the discard: the highest-point loose card that is not wild (never the card just taken from the open pile).
  const best = R.bestArrangement(hand, wildRank);
  let discard;
  const loose = best.deadwood.filter((x) => !R.isWild(x, wildRank) && !(source === 'OPEN' && x.id === drawn.id));
  if (loose.length) {
    discard = loose.reduce((a, b) => (R.cardPoints(b, wildRank) > R.cardPoints(a, wildRank) ? b : a));
  } else {
    // Everything is melded with 14 cards: drop a card whose removal keeps the hand at its best.
    let bestPts = Infinity;
    for (const cand of hand) {
      if (R.isWild(cand, wildRank)) continue;
      const pts = pointsOf(hand.filter((x) => x.id !== cand.id), wildRank);
      if (pts < bestPts) { bestPts = pts; discard = cand; }
      if (pts === 0) break;
    }
    discard = discard || hand[0];
  }
  game.hands.cpu = hand.filter((x) => x.id !== discard.id);
  game.open.push(discard);
  game.lastCpuMove = { source, drew: source === 'OPEN' ? drawn : null, discarded: discard };

  const after = R.bestArrangement(game.hands.cpu, wildRank);
  if (after.points === 0 && R.scoreGroups(after.groups, wildRank).valid) {
    endGame(game, 'cpu', 'COMPUTER_DECLARED');
    return;
  }
  game.turn = 'you';
  game.phase = 'DRAW';
}

// ---------------------------------------------------------------- player actions

function getOwned(owner, gameId) {
  const game = games.get(String(gameId || ''));
  if (!game || game.owner !== owner) throw new GameError('NOT_FOUND', 'Game not found. Start a new one.');
  game.updatedAt = Date.now();
  return game;
}

function start(owner) {
  const existing = byOwner.get(owner);
  if (existing && games.get(existing)?.phase !== 'ENDED') return games.get(existing);
  return newGame(owner);
}

function restart(owner) {
  const existing = byOwner.get(owner);
  if (existing) games.delete(existing);
  return newGame(owner);
}

function draw(owner, gameId, source) {
  const game = getOwned(owner, gameId);
  if (game.turn !== 'you' || game.phase !== 'DRAW') throw new GameError('NOT_YOUR_TURN', 'You cannot draw now.');
  let card;
  if (source === 'OPEN') {
    const top = game.open[game.open.length - 1];
    if (!top) throw new GameError('EMPTY', 'The open pile is empty.');
    if (R.isWild(top, game.wildRank)) throw new GameError('JOKER_ON_PILE', 'A joker on the open pile cannot be picked.');
    card = game.open.pop();
  } else {
    card = drawClosed(game);
  }
  game.hands.you.push(card);
  game.phase = 'DISCARD';
  game.playerTurns += 1;
  game.drawnId = card.id;
  return { game, card };
}

function discard(owner, gameId, cardId) {
  const game = getOwned(owner, gameId);
  if (game.turn !== 'you' || game.phase !== 'DISCARD') throw new GameError('NOT_YOUR_TURN', 'Draw a card first.');
  const card = game.hands.you.find((x) => x.id === cardId);
  if (!card) throw new GameError('INVALID_CARD', 'That card is not in your hand.');
  game.hands.you = game.hands.you.filter((x) => x.id !== cardId);
  game.open.push(card);
  game.turn = 'cpu';
  game.lastCpuMove = null;
  computerTurn(game);
  return game;
}

/**
 * Declare: the player puts `finishId` on the finish slot and shows the other 13 cards in `groups`.
 * A wrong show costs 80 points and hands the game to the Computer.
 */
function declare(owner, gameId, groups, finishId) {
  const game = getOwned(owner, gameId);
  if (game.turn !== 'you' || game.phase !== 'DISCARD') throw new GameError('NOT_YOUR_TURN', 'Draw a card before you declare.');
  const hand = game.hands.you;
  const finish = hand.find((x) => x.id === finishId);
  if (!finish) throw new GameError('INVALID_CARD', 'Choose a card to finish with.');
  const byId = new Map(hand.map((x) => [x.id, x]));
  const ids = (Array.isArray(groups) ? groups : []).flat();
  const unique = new Set(ids);
  if (ids.length !== 13 || unique.size !== 13 || unique.has(finishId) || ids.some((id) => !byId.has(id))) {
    throw new GameError('INVALID_GROUPS', 'Group all 13 remaining cards before declaring.');
  }
  const cardGroups = groups.map((g) => g.map((id) => byId.get(id)));
  game.hands.you = cardGroups.flat();
  game.open.push(finish);
  const scored = R.scoreGroups(cardGroups, game.wildRank);
  if (scored.valid) endGame(game, 'you', 'DECLARED');
  else endGame(game, 'cpu', 'WRONG_SHOW', { youPoints: R.MAX_POINTS });
  return game;
}

function drop(owner, gameId) {
  const game = getOwned(owner, gameId);
  if (game.turn !== 'you' || game.phase !== 'DRAW') throw new GameError('NOT_YOUR_TURN', 'You can drop only at the start of your turn.');
  endGame(game, 'cpu', 'DROPPED', { youPoints: game.playerTurns === 0 ? R.FIRST_DROP : R.MIDDLE_DROP });
  return game;
}

/** Suggested grouping for the player's current hand (the "Sort" button). */
function suggest(owner, gameId) {
  const game = getOwned(owner, gameId);
  const groups = R.displayArrangement(game.hands.you, game.wildRank);
  return { groups: groups.map((g) => g.map((x) => x.id)), deadwood: [], points: R.bestArrangement(game.hands.you, game.wildRank).points };
}

/** Labels and points for the player's own grouping, without committing anything. */
function check(owner, gameId, groups) {
  const game = getOwned(owner, gameId);
  const byId = new Map(game.hands.you.map((x) => [x.id, x]));
  const cardGroups = (Array.isArray(groups) ? groups : []).map((g) => (Array.isArray(g) ? g : []).map((id) => byId.get(id)).filter(Boolean));
  const kinds = cardGroups.map((g) => R.classify(g, game.wildRank));
  return { kinds, points: R.scoreGroups(cardGroups.filter((g) => g.length), game.wildRank).points };
}

function toPublic(game) {
  const ended = game.phase === 'ENDED';
  return {
    id: game.id,
    phase: game.phase,
    turn: game.turn,
    hand: game.hands.you,
    drawnId: game.phase === 'DISCARD' ? game.drawnId : null,
    cpuCount: game.hands.cpu.length,
    openTop: game.open[game.open.length - 1] || null,
    openCount: game.open.length,
    closedCount: game.closed.length,
    wildCard: game.wildCard,
    wildRank: game.wildRank,
    canDrop: game.turn === 'you' && game.phase === 'DRAW',
    dropPenalty: game.playerTurns === 0 ? R.FIRST_DROP : R.MIDDLE_DROP,
    lastCpuMove: game.lastCpuMove,
    result: game.result,
    serverSeedHash: game.serverSeedHash,
    serverSeed: ended ? game.serverSeed : null
  };
}

/** Drops idle practice games so memory stays bounded. */
function sweep(now = Date.now()) {
  for (const [id, g] of games) {
    if (now - g.updatedAt > IDLE_MS) {
      games.delete(id);
      if (byOwner.get(g.owner) === id) byOwner.delete(g.owner);
    }
  }
}

module.exports = { start, restart, draw, discard, declare, drop, suggest, check, toPublic, sweep, _games: games, _computerTurn: computerTurn };
