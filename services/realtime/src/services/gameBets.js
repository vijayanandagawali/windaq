/**
 * Shared, server-authoritative money path for every game.
 *
 * - Identity comes ONLY from the authenticated socket session (never from client payloads).
 * - Stakes are validated strictly (finite, positive, max 2 decimals, within game limits).
 * - Debits and settlements go through the ledgered wallet service (row lock + double entry),
 *   keyed by the bet id, so a bet can never be charged or paid twice.
 */
const { PrismaClient } = require('@prisma/client');
const walletService = require('./walletService');

const prisma = new PrismaClient();

class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Returns the authenticated real player id for a socket, or throws AUTH_REQUIRED. */
function requirePlayer(socket) {
  const userId = socket.user?.userId;
  if (!userId || userId === 'guest' || socket.user?.role === 'viewer') {
    throw new GameError('AUTH_REQUIRED', 'Please sign in to play.');
  }
  return userId;
}

function toPaiseFromRupees(value) {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new GameError('INVALID_AMOUNT', 'Enter a valid stake.');
  const paise = Math.round(num * 100);
  if (Math.abs(paise - num * 100) > 1e-6) throw new GameError('INVALID_AMOUNT', 'Stake can have at most 2 decimal places.');
  return BigInt(paise);
}

/**
 * Parses a stake given in rupees (or paise when unit === 'paise') and enforces limits in rupees.
 */
function parseStake(value, { min = 10, max = 50000, unit = 'rupees' } = {}) {
  let paise;
  if (unit === 'paise') {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) throw new GameError('INVALID_AMOUNT', 'Enter a valid stake.');
    paise = BigInt(num);
  } else {
    paise = toPaiseFromRupees(value);
  }
  if (paise < BigInt(Math.round(min * 100)) || paise > BigInt(Math.round(max * 100))) {
    throw new GameError('INVALID_AMOUNT', `Stake must be between ₹${min} and ₹${max}.`);
  }
  return paise;
}

/** Debits a stake inside an existing transaction. Returns the new wallet balance (paise). */
function debitStake(tx, userId, amountPaise, game, betId) {
  return walletService.placeBet(tx, userId, amountPaise, `${game.toUpperCase()}_BET`, betId);
}

function isDuplicateLedgerEntry(err) {
  return err && (err.code === 'P2002' || /Unique constraint/i.test(err.message || ''));
}

/**
 * Settles a bet: payout > 0 pays the payout (stake returned + net win/loss), otherwise the stake
 * is moved from the wager reserve to revenue. Safe to call more than once for the same bet.
 * @returns {Promise<{ settled: boolean, alreadySettled?: boolean }>}
 */
async function settleBet(userId, stakePaise, payoutPaise, game, betId) {
  try {
    await prisma.$transaction(async (tx) => {
      if (payoutPaise > 0n) {
        await walletService.settleWin(tx, userId, stakePaise, payoutPaise, `${game.toUpperCase()}_WIN`, betId);
      } else {
        await walletService.settleLoss(tx, userId, stakePaise, `${game.toUpperCase()}_LOSS`, betId);
      }
    });
    // Private, server-authoritative outcome for the player's UI (win/loss banners use this, not client maths).
    walletService.emitWalletEvent(userId, 'bet:settled', {
      game,
      betId,
      stake: Number(stakePaise) / 100,
      payout: Number(payoutPaise) / 100
    });
    return { settled: true };
  } catch (err) {
    if (isDuplicateLedgerEntry(err)) return { settled: false, alreadySettled: true };
    throw err;
  }
}

/** Refunds a stake (e.g. voided round). Idempotent per bet id. */
async function refundBet(userId, stakePaise, game, betId) {
  try {
    await prisma.$transaction((tx) => walletService.refundBet(tx, userId, stakePaise, `${game.toUpperCase()}_REFUND`, betId));
    return { refunded: true };
  } catch (err) {
    if (isDuplicateLedgerEntry(err)) return { refunded: false, alreadyRefunded: true };
    throw err;
  }
}

/** Standard socket error reply; never leaks internal error text. */
function replyError(callback, err, context) {
  const known = err instanceof GameError || /Insufficient available balance|restricted|does not permit|configured daily limit/i.test(err?.message || '');
  if (!known) console.error(`[${context}]`, err?.message);
  const payload = {
    success: false,
    code: err?.code || (known ? 'REJECTED' : 'SERVER_ERROR'),
    message: known ? err.message : 'Something went wrong. Please try again.'
  };
  if (typeof callback === 'function') callback(payload);
  return payload;
}

module.exports = { GameError, requirePlayer, parseStake, debitStake, settleBet, refundBet, replyError, prisma };
