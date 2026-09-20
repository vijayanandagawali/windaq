const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

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
    
    // Also send basic invariant check
    // In a real production system, this check runs via a cron job, but we'll do a quick check here.
    const agg = await prisma.ledgerTransaction.groupBy({
      by: ['debitAccountId'],
      _sum: { amount: true }
    });
    
    res.json({ success: true, data: transactions, invariants: agg });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const { ensureUserAndWallet } = require('../services/walletService');

router.get('/balance', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.user?.userId || 'sbx-usr-normal-001';
    let wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
    if (!wallet) {
      const ensured = await ensureUserAndWallet(prisma, userId);
      wallet = ensured.wallet;
    }
    res.json({ 
      success: true, 
      balancePaise: wallet ? wallet.balance.toString() : '0',
      balance: wallet ? Number(wallet.balance) / 100 : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await prisma.ledgerAccount.findMany({
      take: 100
    });
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
