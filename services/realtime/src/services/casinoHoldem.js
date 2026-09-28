/**
 * Casino Hold'em: the player against the house dealer, one hand at a time.
 *
 *   1. The player posts an ante. Two cards each for player and dealer, five board cards are fixed
 *      by the shuffle; only the flop (first three) is shown.
 *   2. The player folds (ante lost) or calls with 2x the ante.
 *   3. On a call the turn, river and dealer cards are revealed. The dealer qualifies with a pair
 *      of fours or better.
 *        dealer does not qualify -> ante paid by the paytable, call returned
 *        player wins             -> ante paid by the paytable, call pays 1:1
 *        split                   -> ante and call returned
 *        dealer wins             -> ante and call lost
 *
 * Ante paytable (winnings per unit): Royal Flush 100, Straight Flush 20, Four of a Kind 10,
 * Full House 3, Flush 2, Straight or lower 1.
 *
 * The deck is provably fair: the SHA-256 of the server seed is shown when the hand is dealt and the
 * seed is revealed at settlement. Money moves only through the ledger (debitStake / settleBet),
 * with the ante under the hand id and the call under `<id>-call`, so nothing can be paid twice.
 */
const crypto = require('crypto');
const provablyFair = require('./ProvablyFairService');
const { evaluate, compareScores, CATEGORY } = require('./cards/pokerHands');
const { debitStake, settleBet, GameError, prisma } = require('./gameBets');

const GAME = 'holdem';
const MIN_ANTE_PAISE = 1000n;    // ₹10
const MAX_ANTE_PAISE = 1000000n; // ₹10,000 (a call doubles it)
const DECISION_TIMEOUT_MS = 10 * 60 * 1000;

const ANTE_WINNINGS = {
  [CATEGORY.ROYAL_FLUSH]: 100,
  [CATEGORY.STRAIGHT_FLUSH]: 20,
  [CATEGORY.FOUR_OF_A_KIND]: 10,
  [CATEGORY.FULL_HOUSE]: 3,
  [CATEGORY.FLUSH]: 2
};
const anteWinnings = (category) => ANTE_WINNINGS[category] || 1;

const callBetId = (handId) => `${handId}-call`;

/** Dealer qualifies with a pair of fours or better. */
function dealerQualifies(dealerEval) {
  if (dealerEval.category > CATEGORY.PAIR) return true;
  return dealerEval.category === CATEGORY.PAIR && dealerEval.score[1] >= 4;
}

/** Deals from the seeds: player 2, dealer 2, then the five board cards, in that order. */
function deal(serverSeed, clientSeed) {
  const deck = provablyFair.shuffleDeck(serverSeed, clientSeed, 0);
  return { playerCards: [deck[0], deck[2]], dealerCards: [deck[1], deck[3]], board: deck.slice(4, 9) };
}

/** Pure outcome for a called hand: amounts in paise (stake included). */
function resolveCalled(hand) {
  const player = evaluate([...hand.playerCards, ...hand.board]);
  const dealer = evaluate([...hand.dealerCards, ...hand.board]);
  const qualifies = dealerQualifies(dealer);
  const ante = BigInt(hand.ante);
  const call = BigInt(hand.call);
  const anteWin = ante + ante * BigInt(anteWinnings(player.category));
  let outcome;
  let antePayout;
  let callPayout;
  if (!qualifies) {
    outcome = 'DEALER_NOT_QUALIFIED';
    antePayout = anteWin;
    callPayout = call;
  } else {
    const cmp = compareScores(player.score, dealer.score);
    if (cmp > 0) { outcome = 'PLAYER_WINS'; antePayout = anteWin; callPayout = call * 2n; }
    else if (cmp === 0) { outcome = 'PUSH'; antePayout = ante; callPayout = call; }
    else { outcome = 'DEALER_WINS'; antePayout = 0n; callPayout = 0n; }
  }
  return {
    outcome,
    dealerQualifies: qualifies,
    player: { category: player.name, label: player.label },
    dealer: { category: dealer.name, label: dealer.label },
    antePayout,
    callPayout
  };
}

/** What the player may see: dealer cards and the turn/river stay hidden until the hand ends. */
function toPublic(hand) {
  if (!hand) return null;
  const done = hand.status !== 'DECIDING';
  const called = hand.status === 'SETTLED';
  const result = hand.result || null;
  const flop = (hand.board || []).slice(0, 3);
  return {
    id: hand.id,
    status: hand.status,
    ante: Number(hand.ante) / 100,
    call: Number(hand.call) / 100,
    playerCards: hand.playerCards,
    board: called ? hand.board : flop,
    dealerCards: done ? hand.dealerCards : [{ hidden: true }, { hidden: true }],
    playerHand: evaluate([...hand.playerCards, ...(called ? hand.board : flop)]).label,
    result: done ? result : null,
    payout: Number(hand.payout) / 100,
    serverSeedHash: hand.serverSeedHash,
    serverSeed: done ? hand.serverSeed : null,
    clientSeed: hand.clientSeed,
    decideBy: hand.status === 'DECIDING' ? new Date(new Date(hand.createdAt).getTime() + DECISION_TIMEOUT_MS).toISOString() : null
  };
}

function parseAnte(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || Math.round(num * 100) !== num * 100) throw new GameError('INVALID_AMOUNT', 'Enter a valid ante.');
  const paise = BigInt(Math.round(num * 100));
  if (paise < MIN_ANTE_PAISE || paise > MAX_ANTE_PAISE) throw new GameError('INVALID_AMOUNT', 'Ante must be between ₹10 and ₹10,000.');
  return paise;
}

async function openHandFor(userId) {
  return prisma.casinoHoldemHand.findFirst({ where: { userId, status: 'DECIDING' }, orderBy: { createdAt: 'desc' } });
}

/** Deals a new hand after debiting the ante. One open hand per player at a time. */
async function dealHand(userId, { ante, clientSeed } = {}) {
  const antePaise = parseAnte(ante);
  await expireStale(userId);
  if (await openHandFor(userId)) throw new GameError('HAND_IN_PROGRESS', 'Finish your current hand first.');

  const id = crypto.randomUUID();
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const seed = String(clientSeed || crypto.randomBytes(8).toString('hex')).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'player';
  const cards = deal(serverSeed, seed);

  const hand = await prisma.$transaction(async (tx) => {
    await debitStake(tx, userId, antePaise, GAME, id);
    return tx.casinoHoldemHand.create({
      data: {
        id,
        userId,
        ante: antePaise,
        serverSeed,
        serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
        clientSeed: seed,
        ...cards
      }
    });
  });
  return hand;
}

/** Player decision on an open hand. The status claim makes a second decision impossible. */
async function decide(userId, handId, action) {
  const act = String(action || '').toUpperCase();
  if (act !== 'CALL' && act !== 'FOLD') throw new GameError('INVALID_ACTION', 'Choose Call or Fold.');
  const hand = await prisma.casinoHoldemHand.findUnique({ where: { id: String(handId || '') } });
  if (!hand || hand.userId !== userId) throw new GameError('NOT_FOUND', 'Hand not found.');
  if (hand.status !== 'DECIDING') throw new GameError('ALREADY_DECIDED', 'This hand is already finished.');
  return act === 'FOLD' ? fold(hand, 'FOLD') : call(hand);
}

async function fold(hand, reason) {
  const claimed = await prisma.casinoHoldemHand.updateMany({
    where: { id: hand.id, status: 'DECIDING' },
    data: { status: 'FOLDED', result: { outcome: reason === 'TIMEOUT' ? 'TIMED_OUT' : 'FOLDED' } }
  });
  if (claimed.count !== 1) throw new GameError('ALREADY_DECIDED', 'This hand is already finished.');
  await settleBet(hand.userId, BigInt(hand.ante), 0n, GAME, hand.id);
  return prisma.casinoHoldemHand.findUnique({ where: { id: hand.id } });
}

async function call(hand) {
  const callPaise = BigInt(hand.ante) * 2n;
  // Debit the call and claim the hand together: if the player cannot afford the call, nothing changes.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.casinoHoldemHand.updateMany({ where: { id: hand.id, status: 'DECIDING' }, data: { status: 'CALLING', call: callPaise } });
    if (claimed.count !== 1) throw new GameError('ALREADY_DECIDED', 'This hand is already finished.');
    await debitStake(tx, hand.userId, callPaise, GAME, callBetId(hand.id));
  });

  const called = { ...hand, call: callPaise };
  const r = resolveCalled(called);
  // Idempotent per bet id; if this is interrupted, recoverStuckCalls finishes the hand.
  await settleBet(hand.userId, BigInt(hand.ante), r.antePayout, GAME, hand.id);
  await settleBet(hand.userId, callPaise, r.callPayout, GAME, callBetId(hand.id));
  const { antePayout, callPayout, ...result } = r;
  return prisma.casinoHoldemHand.update({
    where: { id: hand.id },
    data: { status: 'SETTLED', result, payout: antePayout + callPayout }
  });
}

/**
 * Hands left undecided past the timeout are folded, as at a live table. Called before dealing and
 * periodically by the server.
 */
async function expireStale(userId = null) {
  const stale = await prisma.casinoHoldemHand.findMany({
    where: { status: 'DECIDING', createdAt: { lt: new Date(Date.now() - DECISION_TIMEOUT_MS) }, ...(userId ? { userId } : {}) },
    take: 100
  });
  for (const hand of stale) {
    await fold(hand, 'TIMEOUT').catch(() => {});
  }
  return stale.length;
}

/** Finishes calls whose settlement was interrupted (e.g. a restart between debit and payout). */
async function recoverStuckCalls() {
  const stuck = await prisma.casinoHoldemHand.findMany({ where: { status: 'CALLING', updatedAt: { lt: new Date(Date.now() - 60 * 1000) } }, take: 50 });
  for (const hand of stuck) {
    const r = resolveCalled(hand);
    await settleBet(hand.userId, BigInt(hand.ante), r.antePayout, GAME, hand.id);
    await settleBet(hand.userId, BigInt(hand.call), r.callPayout, GAME, callBetId(hand.id));
    const { antePayout, callPayout, ...result } = r;
    await prisma.casinoHoldemHand.updateMany({ where: { id: hand.id, status: 'CALLING' }, data: { status: 'SETTLED', result, payout: antePayout + callPayout } });
  }
  return stuck.length;
}

module.exports = {
  GAME,
  ANTE_WINNINGS,
  dealerQualifies,
  deal,
  resolveCalled,
  toPublic,
  openHandFor,
  dealHand,
  decide,
  expireStale,
  recoverStuckCalls
};
