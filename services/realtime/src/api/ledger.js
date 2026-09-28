const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { getWallet } = require('../services/walletService');
const manualPayments = require('../services/manualPaymentService');
const bankSms = require('../services/bankSmsService');
const { requireRole } = require('../middleware/AdminRBAC');

function rejectIfRealMoneyDisabled(res) {
  if (bankSms.isRealMoneyEnabled()) return false;
  res.status(503).json({ success: false, code: 'PAYMENTS_DISABLED', message: 'Deposits and withdrawals are currently unavailable.' });
  return true;
}

function sendPaymentError(res, error, action) {
  if (error instanceof manualPayments.PaymentRequestError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  if (/Insufficient available balance|restricted/i.test(error.message || '')) {
    return res.status(400).json({ success: false, code: 'REQUEST_REJECTED', message: error.message });
  }
  console.error(`[Ledger ${action} Error]:`, error.message);
  return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Request could not be processed. Please try again.' });
}

/**
 * GET /api/ledger/balance
 * Returns authoritative PostgreSQL balance breakdowns.
 * Strictly 0% fabricated values (Prompt #69 Phase 2).
 */
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || (process.env.NODE_ENV === 'test' ? 'TEST_PLAYER_01' : null);
    if (!userId) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }
    const wallet = await getWallet(prisma, userId);

    const totalPaise = BigInt(wallet.balance || 0n);
    const lockedPaise = BigInt(wallet.lockedBalance || 0n);
    const availablePaise = totalPaise >= lockedPaise ? (totalPaise - lockedPaise) : 0n;

    res.json({ 
      success: true, 
      balancePaise: totalPaise.toString(),
      balance: Number(totalPaise) / 100,
      totalBalance: Number(totalPaise) / 100,
      availableBalance: Number(availablePaise) / 100,
      availableBalancePaise: availablePaise.toString(),
      lockedBalance: Number(lockedPaise) / 100,
      lockedBalancePaise: lockedPaise.toString(),
      pendingDeposit: Number(wallet.pendingDeposit || 0n) / 100,
      pendingWithdrawal: Number(wallet.pendingWithdrawal || 0n) / 100,
      bonusBalance: Number(wallet.bonusBalance || 0n) / 100,
      // Backward compatibility mappings
      depositBalance: Number(availablePaise) / 100,
      winningBalance: Number(availablePaise) / 100,
      totalDeposited: Number(wallet.totalDeposited || 0n) / 100,
      totalWithdrawn: Number(wallet.totalWithdrawn || 0n) / 100,
      totalWon: Number(wallet.totalWon || 0n) / 100,
      totalLost: Number(wallet.totalLost || 0n) / 100,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ledger/transactions
 * Comprehensive user transaction history with filters (type, status, date range, search)
 */
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || (process.env.NODE_ENV === 'test' ? 'TEST_PLAYER_01' : null);
    if (!userId) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }
    const { type, status, dateRange, search, limit = 50, offset = 0 } = req.query;

    const wallet = await getWallet(prisma, userId);

    // Build Date Filter
    let dateFilter = {};
    const now = new Date();
    if (dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (dateRange === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: sevenDaysAgo };
    } else if (dateRange === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: thirtyDaysAgo };
    }

    // Build Type Filter for Wallet Transactions
    let typeFilter = undefined;
    if (type && type !== 'ALL') {
      const upperType = type.toUpperCase();
      if (upperType === 'DEPOSIT') typeFilter = 'DEPOSIT';
      else if (upperType === 'WITHDRAWAL' || upperType === 'WITHDRAW') typeFilter = 'WITHDRAWAL';
      else if (upperType === 'BET' || upperType === 'BET_PLACE') typeFilter = 'BET_PLACE';
      else if (upperType === 'WIN' || upperType === 'BET_WIN') typeFilter = 'BET_WIN';
      else if (upperType === 'REFUND') typeFilter = 'REFUND';
      else if (upperType === 'BONUS' || upperType === 'ADJUSTMENT') typeFilter = 'MANUAL_ADJUSTMENT';
    }

    // 1. Fetch wallet-level transactions
    const walletWhere = {
      walletId: wallet.id,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      ...(search ? { reference: { contains: search, mode: 'insensitive' } } : {})
    };

    const [transactions, totalCount] = await Promise.all([
      prisma.transaction.findMany({
        where: walletWhere,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.transaction.count({ where: walletWhere })
    ]);

    // 2. Fetch pending or failed payment intents to ensure full lifecycle visibility
    const paymentIntents = await prisma.paymentIntent.findMany({
      where: {
        userId,
        status: { in: ['INITIATED', 'PENDING', 'PENDING_REVIEW', 'FAILED'] },
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // 3. Format & enrich with ledger metadata
    const formatted = transactions.map(tx => {
      const amountPaise = BigInt(tx.amount);
      const isCredit = tx.type === 'DEPOSIT' || tx.type === 'BET_WIN' || tx.type === 'REFUND' || tx.type === 'MANUAL_ADJUSTMENT';
      const amountNum = (Number(amountPaise) / 100) * (isCredit ? 1 : -1);

      let desc = 'Gaming Transaction';
      if (tx.type === 'DEPOSIT') desc = 'Instant UPI Deposit';
      else if (tx.type === 'WITHDRAWAL') desc = 'Withdrawal to Bank/UPI';
      else if (tx.type === 'BET_PLACE') desc = `Bet on ${tx.reference || 'Casino Game'}`;
      else if (tx.type === 'BET_WIN') desc = `Win in ${tx.reference || 'Casino Game'}`;
      else if (tx.type === 'REFUND') desc = `Refund for ${tx.reference || 'Game Round'}`;
      else if (tx.type === 'MANUAL_ADJUSTMENT') desc = 'Promotional / Bonus Credit';

      return {
        id: tx.id,
        idempotencyKey: tx.idempotencyKey,
        type: tx.type,
        amount: amountNum,
        amountPaise: amountPaise.toString(),
        balanceAfter: Number(tx.balanceAfter) / 100,
        status: 'COMPLETED',
        reference: tx.reference || 'Direct',
        description: desc,
        date: tx.createdAt.toISOString(),
        ledger: {
          debitAccountId: isCredit ? (tx.type === 'DEPOSIT' ? 'SYSTEM:EXTERNAL_BANK' : (tx.type === 'BET_WIN' ? 'SYSTEM:REVENUE' : 'SYSTEM:WAGER_RESERVE')) : `USER:${userId}`,
          creditAccountId: isCredit ? `USER:${userId}` : (tx.type === 'WITHDRAWAL' ? 'SYSTEM:EXTERNAL_BANK' : 'SYSTEM:WAGER_RESERVE'),
          status: 'COMPLETED'
        }
      };
    });

    // Add pending payment intents if matching filter
    for (const intent of paymentIntents) {
      if (status && status !== 'ALL' && intent.status !== status) continue;

      const isCredit = intent.type === 'DEPOSIT';
      const amountNum = (Number(intent.amount) / 100) * (isCredit ? 1 : -1);

      formatted.unshift({
        id: intent.id,
        idempotencyKey: intent.providerReference || intent.id,
        type: intent.type,
        amount: amountNum,
        amountPaise: intent.amount.toString(),
        balanceAfter: wallet.availableBalanceNumber,
        status: intent.status === 'INITIATED' || intent.status === 'PENDING' || intent.status === 'PENDING_REVIEW' ? 'PENDING' : 'FAILED',
        reference: intent.providerReference || intent.provider || 'UPI',
        description: `${intent.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} (${intent.provider || 'UPI'})`,
        date: intent.createdAt.toISOString(),
        ledger: {
          debitAccountId: isCredit ? 'SYSTEM:EXTERNAL_BANK' : `USER:${userId}`,
          creditAccountId: isCredit ? `USER:${userId}` : 'SYSTEM:WITHDRAWAL_LIABILITY',
          status: intent.status
        }
      });
    }

    res.json({
      success: true,
      data: formatted,
      totalCount: totalCount + paymentIntents.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('[GET /api/ledger/transactions Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ledger/transactions/:id
 * Detailed transaction receipt inspection (Prompt #69 Phase 19)
 */
router.get('/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.headers['x-user-id'] || (process.env.NODE_ENV === 'test' ? 'TEST_PLAYER_01' : null);

    // Check in Transaction table
    let tx = await prisma.transaction.findUnique({
      where: { id },
      include: { wallet: true }
    });

    if (!tx) {
      // Check in PaymentIntent table
      const intent = await prisma.paymentIntent.findUnique({ where: { id } });
      if (intent) {
        if (userId && intent.userId !== userId && req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
          return res.status(403).json({ success: false, message: 'Unauthorized transaction access.' });
        }
        return res.json({
          success: true,
          data: {
            id: intent.id,
            idempotencyKey: intent.providerReference || intent.id,
            type: intent.type,
            amount: Number(intent.amount) / 100,
            amountPaise: intent.amount.toString(),
            status: intent.status,
            reference: intent.providerReference,
            provider: intent.provider,
            description: `${intent.type} via ${intent.provider}`,
            createdAt: intent.createdAt.toISOString(),
            updatedAt: intent.updatedAt.toISOString(),
            timeline: [
              { step: 'CREATED', status: 'COMPLETED', timestamp: intent.createdAt.toISOString() },
              { step: 'PROCESSING', status: intent.status === 'INITIATED' ? 'CURRENT' : 'COMPLETED', timestamp: intent.updatedAt.toISOString() },
              { step: 'SETTLED', status: intent.status === 'SUCCESS' ? 'COMPLETED' : (intent.status === 'FAILED' ? 'FAILED' : 'PENDING'), timestamp: intent.updatedAt.toISOString() }
            ]
          }
        });
      }
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    if (userId && tx.wallet.userId !== userId && req.user?.role !== 'SUPER_ADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized transaction access.' });
    }

    // Look up matching ledger transaction
    const ledgerTx = await prisma.ledgerTransaction.findFirst({
      where: {
        OR: [
          { referenceId: tx.reference },
          { idempotencyKey: tx.idempotencyKey },
          { idempotencyKey: { contains: tx.id } }
        ]
      },
      include: {
        debitAccount: true,
        creditAccount: true
      }
    });

    res.json({
      success: true,
      data: {
        id: tx.id,
        idempotencyKey: tx.idempotencyKey,
        type: tx.type,
        amount: Number(tx.amount) / 100,
        amountPaise: tx.amount.toString(),
        balanceAfter: Number(tx.balanceAfter) / 100,
        reference: tx.reference,
        status: 'COMPLETED',
        createdAt: tx.createdAt.toISOString(),
        ledger: ledgerTx ? {
          id: ledgerTx.id,
          debitAccountId: ledgerTx.debitAccountId,
          creditAccountId: ledgerTx.creditAccountId,
          amount: Number(ledgerTx.amount) / 100,
          status: ledgerTx.status,
          referenceType: ledgerTx.referenceType,
          createdAt: ledgerTx.createdAt.toISOString()
        } : null,
        timeline: [
          { step: 'TRANSACTION_INITIATED', status: 'COMPLETED', timestamp: tx.createdAt.toISOString() },
          { step: 'LEDGER_VERIFIED', status: 'COMPLETED', timestamp: tx.createdAt.toISOString() },
          { step: 'SETTLED_POSTGRESQL', status: 'COMPLETED', timestamp: tx.createdAt.toISOString() }
        ]
      }
    });

  } catch (error) {
    console.error('[GET /api/ledger/transactions/:id Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function depositView(intent) {
  return {
    intentId: intent.id,
    amount: Number(intent.amount) / 100,
    requestedAmount: intent.metadata?.requestedPaise ? Number(intent.metadata.requestedPaise) / 100 : Number(intent.amount) / 100,
    status: intent.status,
    expiresAt: intent.metadata?.expiresAt || null,
    utr: intent.metadata?.utr || null
  };
}

/**
 * POST /api/ledger/deposit/start  { amount }  (whole rupees)
 * Reserves a unique amount (e.g. ₹200.37) for this deposit. Paying exactly that amount lets the
 * bank's credit SMS be matched automatically, with no UTR to type.
 */
router.post('/deposit/start', async (req, res) => {
  if (rejectIfRealMoneyDisabled(res)) return;
  try {
    const { intent, reused } = await manualPayments.startDeposit(prisma, req.user, { amount: req.body?.amount });
    res.status(reused ? 200 : 201).json({ success: true, data: { ...depositView(intent), reused } });
  } catch (error) {
    sendPaymentError(res, error, 'deposit start');
  }
});

/**
 * POST /api/ledger/deposit/:id/utr  { utr }
 * Backup for a unique-amount deposit: attach the UTR so it can be matched by reference or reviewed.
 */
router.post('/deposit/:id/utr', async (req, res) => {
  if (rejectIfRealMoneyDisabled(res)) return;
  try {
    const { intent } = await manualPayments.attachDepositUtr(prisma, req.user, req.params.id, req.body?.utr);
    const match = intent.status === 'PENDING_REVIEW' ? await bankSms.tryMatchUtr(prisma, intent.metadata?.utr) : { matched: false };
    const status = match.matched ? 'SUCCESS' : intent.status;
    res.json({ success: true, data: { ...depositView(intent), status } });
  } catch (error) {
    sendPaymentError(res, error, 'deposit utr');
  }
});

/**
 * POST /api/ledger/deposit/instant
 * Submits a deposit for verification. It NEVER credits the wallet directly: the player's UTR is
 * recorded as a PENDING_REVIEW PaymentIntent and finance credits it only after confirming the
 * payment on the bank statement (see /api/payments/admin/deposits). Path kept for client compatibility.
 */
router.post('/deposit/instant', async (req, res) => {
  if (rejectIfRealMoneyDisabled(res)) return;
  try {
    const { intent, duplicate } = await manualPayments.createDepositRequest(prisma, req.user, {
      amount: req.body?.amount,
      utr: req.body?.utr
    });
    // If the bank's credit SMS for this UTR has already arrived, the deposit is credited right now.
    const match = await bankSms.tryMatchUtr(prisma, intent.metadata?.utr);
    const credited = match.matched || intent.status === 'SUCCESS';
    const wallet = credited ? await getWallet(prisma, req.user.userId) : null;
    res.status(credited || duplicate ? 200 : 202).json({
      success: true,
      status: credited ? 'SUCCESS' : 'PENDING_REVIEW',
      message: credited
        ? 'Payment received. Your wallet has been credited.'
        : duplicate
          ? 'This deposit was already submitted and is awaiting the bank confirmation.'
          : 'Deposit submitted. It will be credited automatically as soon as the bank confirms the payment.',
      data: {
        intentId: intent.id,
        utr: intent.metadata?.utr,
        amount: Number(intent.amount) / 100,
        status: credited ? 'SUCCESS' : intent.status,
        isDuplicate: duplicate,
        ...(wallet ? { availableBalance: wallet.availableBalanceNumber } : {})
      }
    });
  } catch (error) {
    sendPaymentError(res, error, 'deposit');
  }
});

/**
 * POST /api/ledger/withdraw/instant
 * Requests a withdrawal. Funds are locked (ledger hold) and the request waits for finance review;
 * nothing is paid out automatically. Path kept for client compatibility.
 */
router.post('/withdraw/instant', async (req, res) => {
  if (rejectIfRealMoneyDisabled(res)) return;
  try {
    const { intent, duplicate } = await manualPayments.createWithdrawalRequest(prisma, req.user, {
      amount: req.body?.amount,
      upiId: req.body?.upiId,
      idempotencyKey: req.body?.idempotencyKey || req.headers['idempotency-key']
    });
    const wallet = await getWallet(prisma, req.user.userId);
    res.status(duplicate ? 200 : 202).json({
      success: true,
      status: 'PENDING_REVIEW',
      message: duplicate
        ? 'This withdrawal was already requested and is awaiting review.'
        : 'Withdrawal requested. The amount is on hold and will be paid out after review.',
      data: {
        intentId: intent.id,
        referenceId: intent.providerReference,
        amount: Number(intent.amount) / 100,
        upiId: intent.metadata?.destination,
        status: intent.status,
        availableBalance: wallet.availableBalanceNumber,
        lockedBalance: wallet.lockedBalanceNumber,
        isDuplicate: duplicate
      }
    });
  } catch (error) {
    sendPaymentError(res, error, 'withdraw');
  }
});

// Where each game page's bets are recorded: ledger games by the stake entry's referenceType,
// round-based table games by their TableGameBet rows.
const HISTORY_SOURCES = {
  dice: { ledger: 'DICE_BET' },
  'color-prediction': { ledger: 'COLOUR_BET' },
  'colour-prediction': { ledger: 'COLOUR_BET' },
  lotto: { ledger: 'LOTTO_BET' },
  'european-roulette': { ledger: 'ROULETTE_BET' },
  blackjack: { ledger: 'BLACKJACK_BET' },
  scratch: { ledger: 'SCRATCH_BET' },
  slots: { ledger: 'SLOTS_BET' },
  aviator: { ledger: 'AVIATOR_BET' },
  'andar-bahar': { table: 'andar-bahar' },
  'dragon-tiger': { table: 'dragon-tiger' }
};

/** Start of the current day in India (UTC+5:30), as a Date. */
function startOfIndianDay(now = new Date()) {
  const offsetMs = 330 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offsetMs);
}

/** Loads the player's stakes for one game, newest first: [{ id, stake (paise), placedAt, market }]. */
async function loadStakes(userId, source, { since, take }) {
  if (source.table) {
    const bets = await prisma.tableGameBet.findMany({
      where: { userId, gameId: source.table, ...(since ? { createdAt: { gte: since } } : {}) },
      orderBy: { createdAt: 'desc' },
      take
    });
    return bets.map((b) => ({ id: b.id, stake: b.amount, placedAt: b.createdAt, market: b.market }));
  }
  const entries = await prisma.ledgerTransaction.findMany({
    where: {
      debitAccountId: `USER:${userId}`,
      referenceType: source.ledger,
      idempotencyKey: { startsWith: 'bet-place-' },
      ...(since ? { createdAt: { gte: since } } : {})
    },
    orderBy: { createdAt: 'desc' },
    take
  });
  return entries.map((e) => ({ id: e.referenceId, stake: e.amount, placedAt: e.createdAt, market: null }));
}

/** Resolves each stake's outcome from the ledger (WON / LOST / REFUNDED / PENDING) and its payout. */
async function resolveOutcomes(userId, stakes) {
  const ids = stakes.map((s) => s.id).filter(Boolean);
  if (ids.length === 0) return [];
  const [wins, closings] = await Promise.all([
    prisma.transaction.findMany({
      where: { type: 'BET_WIN', reference: { in: ids }, wallet: { userId } },
      select: { reference: true, amount: true }
    }),
    prisma.ledgerTransaction.findMany({
      where: { idempotencyKey: { in: ids.flatMap((id) => [`bet-loss-${id}`, `bet-refund-${id}`]) } },
      select: { idempotencyKey: true, referenceId: true }
    })
  ]);
  const payoutById = new Map(wins.map((w) => [w.reference, w.amount]));
  const closingById = new Map(closings.map((c) => [c.referenceId, c.idempotencyKey.startsWith('bet-refund-') ? 'REFUNDED' : 'LOST']));

  return stakes.map((s) => {
    let status = 'PENDING';
    let payout = 0n;
    if (payoutById.has(s.id)) { status = 'WON'; payout = payoutById.get(s.id); }
    else if (closingById.get(s.id) === 'REFUNDED') { status = 'REFUNDED'; payout = s.stake; }
    else if (closingById.get(s.id) === 'LOST') { status = 'LOST'; }
    return { ...s, status, payout };
  });
}

/**
 * GET /api/ledger/game-history?game=<page slug>&limit=30
 * The signed-in player's recent bets on one game plus today's totals, read from the ledger
 * (never from client state), so the numbers always match the wallet.
 */
router.get('/game-history', async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });

    const source = HISTORY_SOURCES[String(req.query.game || '')];
    if (!source) return res.status(400).json({ success: false, code: 'UNKNOWN_GAME', message: 'Unknown game.' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

    const [recent, today] = await Promise.all([
      loadStakes(userId, source, { take: limit }).then((s) => resolveOutcomes(userId, s)),
      loadStakes(userId, source, { since: startOfIndianDay(), take: 2000 }).then((s) => resolveOutcomes(userId, s))
    ]);

    const rupees = (paise) => Number(paise) / 100;
    const settledToday = today.filter((b) => b.status !== 'PENDING');
    const staked = settledToday.reduce((sum, b) => sum + b.stake, 0n);
    const paid = settledToday.reduce((sum, b) => sum + b.payout, 0n);

    res.json({
      success: true,
      data: {
        bets: recent.map((b) => ({
          id: b.id,
          market: b.market,
          stake: rupees(b.stake),
          payout: rupees(b.payout),
          net: b.status === 'PENDING' ? null : rupees(b.payout - b.stake),
          status: b.status,
          placedAt: b.placedAt.toISOString()
        })),
        today: {
          bets: settledToday.length,
          wins: settledToday.filter((b) => b.status === 'WON' && b.payout > b.stake).length,
          staked: rupees(staked),
          paid: rupees(paid),
          net: rupees(paid - staked)
        }
      }
    });
  } catch (error) {
    console.error('[GET /api/ledger/game-history Error]:', error.message);
    res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'History could not be loaded.' });
  }
});

/**
 * GET /api/ledger/wagers
 * Fetches user's game bets and wagers across all categories
 */
router.get('/wagers', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || (process.env.NODE_ENV === 'test' ? 'TEST_PLAYER_01' : null);
    if (!userId) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }
    
    // 1. Fetch Sports / Universal Wagers
    const wagers = await prisma.wager.findMany({
      where: { userId },
      orderBy: { placedAt: 'desc' },
      take: 50
    });

    // 2. Fetch Table Game Bets (Dragon Tiger, Roulette, Andar Bahar)
    const tableBets = await prisma.tableGameBet.findMany({
      where: { userId },
      include: { round: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const formattedWagers = [
      ...wagers.map(w => ({
        id: w.id,
        gameType: w.gameType,
        gameName: w.gameType,
        market: w.market,
        selection: w.selection,
        stake: Number(w.stake) / 100,
        odds: w.odds,
        payout: Number(w.potentialPayout) / 100,
        status: w.status,
        placedAt: w.placedAt.toISOString(),
        settledAt: w.settledAt ? w.settledAt.toISOString() : null
      })),
      ...tableBets.map(b => ({
        id: b.id,
        gameType: 'TABLE_GAME',
        gameName: b.gameId.toUpperCase().replace('-', ' '),
        market: b.market,
        selection: b.market,
        stake: Number(b.amount) / 100,
        odds: b.payout ? (Number(b.payout) / Number(b.amount)) : 1.0,
        payout: Number(b.payout) / 100,
        status: b.payout > 0n ? 'WON' : (b.round?.status === 'SETTLED' ? 'LOST' : 'PENDING'),
        placedAt: b.createdAt.toISOString(),
        settledAt: b.round?.resultTime ? b.round.resultTime.toISOString() : null
      }))
    ].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

    res.json({
      success: true,
      data: formattedWagers
    });
  } catch (error) {
    console.error('[GET /api/ledger/wagers Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ledger (Admin / Invariant inspection)
 */
router.get('/', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const transactions = await prisma.ledgerTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        debitAccount: true,
        creditAccount: true
      }
    });
    
    const agg = await prisma.ledgerTransaction.groupBy({
      by: ['debitAccountId'],
      _sum: { amount: true }
    });
    
    res.json({ success: true, data: transactions, invariants: agg });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
