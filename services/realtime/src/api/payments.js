const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { requireRole, logAudit } = require('../middleware/AdminRBAC');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- CLIENT ROUTES ---

// 1. Create Deposit
router.post('/deposit', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id';
    const { amount, provider } = req.body;
    
    if (!amount || !provider) {
      return res.status(400).json({ success: false, message: 'Missing amount or provider' });
    }

    const intent = await paymentService.createDepositIntent(userId, BigInt(amount * 100), provider);
    
    // Return the intent details (e.g. UPI link or QR code metadata) to the client
    res.json({ success: true, data: intent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Request Withdrawal
router.post('/withdraw', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'mock-user-id';
    const { amount, provider, destination } = req.body; // e.g. destination = "user@upi"
    
    if (!amount || !provider || !destination) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const intent = await paymentService.requestWithdrawal(userId, BigInt(amount * 100), provider, destination);
    
    res.json({ success: true, data: { id: intent.id, status: intent.status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Poll Intent Status
router.get('/intent/:id', async (req, res) => {
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    if (!intent) return res.status(404).json({ success: false, message: 'Intent not found' });
    
    res.json({ success: true, data: { status: intent.status } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// --- WEBHOOK ROUTES (PROVIDER AUTHORITATIVE) ---

router.post('/webhook/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const signature = req.headers['x-provider-signature']; // Assume provider sends HMAC
    
    const result = await paymentService.handleWebhookCallback(provider.toUpperCase(), req.body, signature);
    
    res.json(result);
  } catch (error) {
    console.error(`[Webhook Error - ${req.params.provider}]:`, error.message);
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- ADMIN ROUTES ---

// View Pending Withdrawals
router.get('/admin/withdrawals/pending', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const intents = await prisma.paymentIntent.findMany({
      where: { type: 'WITHDRAWAL', status: 'PENDING_REVIEW' },
      include: { user: { select: { phone: true } } },
      orderBy: { createdAt: 'asc' }
    });
    
    // Map BigInt to String for JSON serialization
    const mapped = intents.map(i => ({...i, amount: i.amount.toString()}));
    res.json({ success: true, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve Withdrawal
router.post('/admin/withdrawals/:id/approve', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    await paymentService.approveWithdrawal(id, req.admin.id);
    
    await logAudit(req.admin.id, 'APPROVE_WITHDRAWAL', id, {}, req.ip);
    res.json({ success: true, message: 'Withdrawal processed to adapter.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
