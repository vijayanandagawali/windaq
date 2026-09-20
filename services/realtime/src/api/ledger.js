const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { getWallet, ensureUserAndWallet } = require('../services/walletService');

/**
 * GET /api/ledger/balance
 * Returns comprehensive balance breakdowns (Total, Deposit, Winning, Bonus)
 */
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || 'sbx-usr-normal-001';
    const wallet = await getWallet(prisma, userId);

    const totalPaise = BigInt(wallet.balance);
    const totalRupees = Number(totalPaise) / 100;
    
    // Virtual breakdown for gaming experience:
    // Winnings = 40% (or up to total), Deposit = 60%, Bonus = ₹500
    const winningRupees = parseFloat((totalRupees * 0.4).toFixed(2));
    const depositRupees = parseFloat((totalRupees * 0.6).toFixed(2));
    const bonusRupees = 500.00;

    res.json({ 
      success: true, 
      balancePaise: totalPaise.toString(),
      balance: totalRupees,
      totalBalance: totalRupees,
      depositBalance: depositRupees,
      winningBalance: winningRupees,
      bonusBalance: bonusRupees,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ledger/transactions
 * Comprehensive user transaction history with filters (type, status, date range)
 * Directly linked to the double-entry ledger.
 */
router.get('/transactions', async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'] || 'sbx-usr-normal-001';
    const { type, status, dateRange, limit = 50, offset = 0 } = req.query;

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
      if (type === 'DEPOSIT') typeFilter = 'DEPOSIT';
      else if (type === 'WITHDRAWAL') typeFilter = 'WITHDRAWAL';
      else if (type === 'BET' || type === 'BET_PLACE') typeFilter = 'BET_PLACE';
      else if (type === 'WIN' || type === 'BET_WIN') typeFilter = 'BET_WIN';
      else if (type === 'REFUND') typeFilter = 'REFUND';
      else if (type === 'BONUS') typeFilter = 'MANUAL_ADJUSTMENT';
    }

    // 1. Fetch wallet-level transactions
    const walletWhere = {
      walletId: wallet.id,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
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
        ...(status && status !== 'ALL' ? { status } : {}),
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
      if (intent.status === 'SUCCESS') continue; // already in transactions
      if (status && status !== 'ALL' && intent.status !== status) continue;

      const isCredit = intent.type === 'DEPOSIT';
      const amountNum = (Number(intent.amount) / 100) * (isCredit ? 1 : -1);

      formatted.unshift({
        id: intent.id,
        idempotencyKey: intent.providerReference || intent.id,
        type: intent.type,
        amount: amountNum,
        amountPaise: intent.amount.toString(),
        balanceAfter: wallet.balanceNumber,
        status: intent.status === 'INITIATED' || intent.status === 'PENDING_REVIEW' ? 'PENDING' : 'FAILED',
        reference: intent.provider || 'UPI',
        description: `${intent.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} (${intent.provider || 'UPI'})`,
        date: intent.createdAt.toISOString(),
        ledger: {
          debitAccountId: isCredit ? 'SYSTEM:EXTERNAL_BANK' : `USER:${userId}`,
          creditAccountId: isCredit ? `USER:${userId}` : 'SYSTEM:PENDING_WITHDRAWALS',
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
 * GET /api/ledger/wagers
 * Fetches user's game bets and wagers across all categories
 */
router.get('/wagers', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.userId || 'sbx-usr-normal-001';
    
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
        status: w.status, // PENDING, WON, LOST, VOID, REFUNDED
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
 * POST /api/ledger/deposit/instant
 * Processes an instant deposit with full double-entry ledger bookkeeping
 */
router.post('/deposit/instant', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.userId || 'sbx-usr-normal-001';
    const { amount, utr, method = 'UPI' } = req.body;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum deposit amount is ₹100.' });
    }

    const amountPaise = BigInt(Math.floor(numAmount * 100));
    const genUtr = utr || `UTR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Ensure user & wallet exist
      const { wallet } = await ensureUserAndWallet(tx, userId);

      // 2. Update wallet balance
      const newBalance = BigInt(wallet.balance) + amountPaise;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });

      // 3. Double-entry ledger transaction
      const userAccountId = `USER:${userId}`;
      await tx.ledgerTransaction.create({
        data: {
          idempotencyKey: `dep-${genUtr}`,
          referenceType: 'DEPOSIT',
          referenceId: genUtr,
          debitAccountId: 'SYSTEM:EXTERNAL_BANK',
          creditAccountId: userAccountId,
          amount: amountPaise,
          status: 'COMPLETED',
          auditMetadata: { utr: genUtr, method }
        }
      });

      // 4. Record wallet transaction
      const txRecord = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          idempotencyKey: `tx-dep-${genUtr}`,
          type: 'DEPOSIT',
          amount: amountPaise,
          balanceAfter: newBalance,
          reference: genUtr
        }
      });

      // 5. Record PaymentIntent
      await tx.paymentIntent.create({
        data: {
          userId,
          amount: amountPaise,
          type: 'DEPOSIT',
          provider: method,
          providerReference: genUtr,
          status: 'SUCCESS',
          metadata: { utr: genUtr }
        }
      });

      return {
        transactionId: txRecord.id,
        utr: genUtr,
        amount: numAmount,
        newBalance: Number(newBalance) / 100
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
 * Requests a withdrawal with balance deduction and double-entry ledger bookkeeping
 */
router.post('/withdraw/instant', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.userId || 'sbx-usr-normal-001';
    const { amount, upiId, method = 'UPI' } = req.body;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 200) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is ₹200.' });
    }

    if (!upiId || !upiId.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid UPI ID (e.g. name@okhdfcbank).' });
    }

    const amountPaise = BigInt(Math.floor(numAmount * 100));
    const refId = `WDR${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

    const result = await prisma.$transaction(async (tx) => {
      const { wallet } = await ensureUserAndWallet(tx, userId);

      if (BigInt(wallet.balance) < amountPaise) {
        throw new Error(`Insufficient balance! Available balance is ₹${Number(wallet.balance) / 100}`);
      }

      const newBalance = BigInt(wallet.balance) - amountPaise;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });

      const userAccountId = `USER:${userId}`;
      await tx.ledgerTransaction.create({
        data: {
          idempotencyKey: `wdr-${refId}`,
          referenceType: 'WITHDRAWAL',
          referenceId: refId,
          debitAccountId: userAccountId,
          creditAccountId: 'SYSTEM:EXTERNAL_BANK',
          amount: amountPaise,
          status: 'COMPLETED',
          auditMetadata: { upiId, method }
        }
      });

      const txRecord = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          idempotencyKey: `tx-wdr-${refId}`,
          type: 'WITHDRAWAL',
          amount: amountPaise,
          balanceAfter: newBalance,
          reference: refId
        }
      });

      await tx.paymentIntent.create({
        data: {
          userId,
          amount: amountPaise,
          type: 'WITHDRAWAL',
          provider: method,
          providerReference: refId,
          status: 'SUCCESS',
          metadata: { upiId }
        }
      });

      return {
        transactionId: txRecord.id,
        referenceId: refId,
        amount: numAmount,
        upiId,
        newBalance: Number(newBalance) / 100
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
