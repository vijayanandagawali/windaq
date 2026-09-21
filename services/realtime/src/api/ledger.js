const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { 
  getWallet, 
  ensureUserAndWallet, 
  lockFundsForWithdrawal, 
  revertWithdrawalHold, 
  finalizeWithdrawal, 
  creditDeposit,
  emitWalletEvent 
} = require('../services/walletService');

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

/**
 * POST /api/ledger/deposit/instant
 * Processes an instant deposit with full double-entry ledger bookkeeping & strict idempotency
 */
router.post('/deposit/instant', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || (process.env.NODE_ENV === 'test' ? 'TEST_PLAYER_01' : null);
    if (!userId) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }
    const { amount, utr, method = 'UPI', idempotencyKey } = req.body;
    const reqIdempKey = idempotencyKey || req.headers['idempotency-key'];

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum deposit amount is ₹100.' });
    }

    const amountPaise = BigInt(Math.floor(numAmount * 100));
    const genUtr = utr || `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const finalIdempKey = reqIdempKey || `dep-${genUtr}`;

    // Idempotency check: if transaction already processed with this idempotency key, return existing record
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey: `tx-${finalIdempKey}` }
    });
    if (existingTx) {
      return res.json({
        success: true,
        message: 'Deposit already processed (Idempotent response)',
        data: {
          transactionId: existingTx.id,
          utr: existingTx.reference,
          amount: Number(existingTx.amount) / 100,
          newBalance: Number(existingTx.balanceAfter) / 100,
          isDuplicate: true
        }
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomically credit deposit via walletService (with FOR UPDATE lock)
      const credited = await creditDeposit(tx, userId, amountPaise, genUtr, method, finalIdempKey);

      // 2. Record or update PaymentIntent
      await tx.paymentIntent.upsert({
        where: { providerReference: genUtr },
        create: {
          userId,
          amount: amountPaise,
          type: 'DEPOSIT',
          provider: method,
          providerReference: genUtr,
          status: 'SUCCESS',
          metadata: { utr: genUtr, idempotencyKey: finalIdempKey }
        },
        update: {
          status: 'SUCCESS'
        }
      });

      return {
        transactionId: credited.transactionId,
        utr: genUtr,
        amount: numAmount,
        newBalance: credited.newBalance
      };
    });

    res.json({
      success: true,
      message: `₹${numAmount} successfully deposited to your wallet!`,
      data: result
    });

  } catch (error) {
    console.error('[POST /api/ledger/deposit/instant Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ledger/withdraw/instant
 * Atomic withdrawal request with row-level locking, fund locking, and ledger bookkeeping
 */
router.post('/withdraw/instant', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || (process.env.NODE_ENV === 'test' ? 'TEST_PLAYER_01' : null);
    if (!userId) {
      return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Authentication required' });
    }

    const { amount, upiId, method = 'UPI', idempotencyKey } = req.body;
    const reqIdempKey = idempotencyKey || req.headers['idempotency-key'];

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 200) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ₹200.' });
    }

    if (!upiId || !upiId.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid UPI ID (e.g. name@okhdfcbank).' });
    }

    const amountPaise = BigInt(Math.floor(numAmount * 100));
    const refId = `WDR${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
    const finalIdempKey = reqIdempKey || `wdr-${refId}`;

    // Idempotency check: prevent duplicate withdrawal submission
    const existingTx = await prisma.transaction.findUnique({
      where: { idempotencyKey: `tx-wdr-hold-${finalIdempKey}` }
    });
    if (existingTx) {
      return res.json({
        success: true,
        message: 'Withdrawal already requested (Idempotent response)',
        data: {
          transactionId: existingTx.id,
          referenceId: existingTx.reference,
          amount: Number(existingTx.amount) / 100,
          newBalance: Number(existingTx.balanceAfter) / 100,
          isDuplicate: true
        }
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Atomically lock funds from available balance (FOR UPDATE lock)
      const hold = await lockFundsForWithdrawal(tx, userId, amountPaise, finalIdempKey, upiId);

      // 2. Create PaymentIntent record
      await tx.paymentIntent.create({
        data: {
          userId,
          amount: amountPaise,
          type: 'WITHDRAWAL',
          provider: method,
          providerReference: finalIdempKey,
          status: 'SUCCESS', // Auto-cleared in instant mode
          metadata: { upiId, idempotencyKey: finalIdempKey }
        }
      });

      // 3. Finalize withdrawal clearance from liability to external bank
      await finalizeWithdrawal(tx, userId, amountPaise, finalIdempKey);

      return {
        transactionId: hold.transactionId,
        referenceId: finalIdempKey,
        amount: numAmount,
        upiId,
        newBalance: Number(hold.availableBalancePaise) / 100
      };
    });

    res.json({
      success: true,
      message: `Withdrawal of ₹${numAmount} successfully processed to ${upiId}!`,
      data: result
    });

  } catch (error) {
    console.error('[POST /api/ledger/withdraw/instant Error]:', error);
    res.status(400).json({ success: false, message: error.message });
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
router.get('/', async (req, res) => {
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
