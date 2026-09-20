const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('./walletService');
const sportsProvider = require('./sports/MockSportsProvider');

/**
 * Validates odds, locks the wager in the DB, and deducts the balance.
 * Ensures server-authoritative checks before a bet is accepted.
 */
async function placeWager({ userId, gameType, referenceId, market, selection, type, stake, clientOdds }) {
  const stakeAmount = BigInt(Math.floor(stake * 100)); // paise

  // 1. Fetch live odds and market status from Provider
  let serverOdds = clientOdds;
  let isSuspended = false;
  let marketConfigSnapshot = {};

  if (gameType === 'SPORTS') {
    const markets = await sportsProvider.syncOdds(referenceId);
    const marketObj = markets.find(m => m.name === market);
    if (!marketObj) throw new Error("Market not found");
    if (marketObj.status === 'SUSPENDED') isSuspended = true;

    const selectionObj = marketObj.selections.find(s => s.name === selection);
    if (!selectionObj) throw new Error("Selection not found");
    if (selectionObj.status === 'SUSPENDED') isSuspended = true;

    serverOdds = type === 'BACK' ? selectionObj.oddsBack : selectionObj.oddsLay;
    marketConfigSnapshot = { marketId: marketObj.id, selectionId: selectionObj.id, rules: marketObj.voidRules };
  }

  // Suspension Check
  if (isSuspended) {
    throw new Error(`Suspended: This market is currently suspended.`);
  }
  
  // Stale Odds Check
  if (serverOdds !== clientOdds) {
    throw new Error(`Stale Odds: The market odds have changed to ${serverOdds}. Please accept the new odds.`);
  }

  // Calculate potential payout
  const potentialPayout = BigInt(Math.floor(Number(stakeAmount) * serverOdds));
  
  // Max Liability / Payout Check (e.g. max win = 1,000,000 INR)
  const MAX_PAYOUT = 1000000n * 100n; // 1,000,000 INR in paise
  if (potentialPayout > MAX_PAYOUT) {
    throw new Error("Max Payout Exceeded: Maximum allowed payout is 1,000,000 INR.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 0. Ensure User, Wallet, and Ledger account exist
    await walletService.ensureUserAndWallet(tx, userId);

    // 1. Create the Wager
    const wager = await tx.wager.create({
      data: {
        userId,
        gameType,
        referenceId,
        market,
        selection,
        type: type || 'BACK',
        stake: stakeAmount,
        odds: serverOdds,
        potentialPayout,
        status: 'PENDING',
        marketConfig: marketConfigSnapshot
      }
    });

    // 2. Deduct funds using the Double-Entry Ledger
    const newBalance = await walletService.placeBet(tx, userId, stakeAmount, 'BET_PLACE', wager.id);

    return { wagerId: wager.id, newBalance: newBalance.toString(), status: 'ACCEPTED' };
  });

  return result;
}

/**
 * Exactly-once settlement. Computes payout and routes to the ledger.
 * Allowed statuses: WON, LOST, VOID, REFUNDED, CANCELLED
 */
async function settleWager(wagerId, status) {
  return await prisma.$transaction(async (tx) => {
    const wager = await tx.wager.findUnique({ where: { id: wagerId } });
    if (!wager) throw new Error("Wager not found");
    if (wager.status !== 'PENDING') throw new Error(`Wager already settled as ${wager.status}`);

    const stakePaise = wager.stake;
    const payoutPaise = wager.potentialPayout;

    // Settle based on rules
    if (status === 'WON') {
      await walletService.settleWin(tx, wager.userId, stakePaise, payoutPaise, 'BET_WIN', wager.id);
    } else if (status === 'LOST') {
      await walletService.settleLoss(tx, wager.userId, stakePaise, 'BET_LOSS', wager.id);
    } else if (['VOID', 'REFUNDED', 'CANCELLED'].includes(status)) {
      await walletService.refundBet(tx, wager.userId, stakePaise, 'REFUND', wager.id);
    } else {
      throw new Error("Invalid settlement status");
    }

    // Update wager state
    const updated = await tx.wager.update({
      where: { id: wager.id },
      data: { status, settledAt: new Date() }
    });

    return updated;
  });
}

module.exports = {
  placeWager,
  settleWager
};
