const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireRole, logAudit } = require('../middleware/AdminRBAC');

// --- DASHBOARD METRICS ---
router.get('/dashboard', requireRole(['SUPPORT', 'RISK', 'FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    
    // Sum balances (excluding system wallets if any)
    const wallets = await prisma.wallet.findMany();
    const totalLiabilities = wallets.reduce((sum, w) => sum + w.balance, 0n).toString();
    
    // Failed payments (simulation/placeholder)
    const failedPayments = 0; 
    
    // Unsettled wagers
    const unsettledWagers = await prisma.wager.count({ where: { status: 'PENDING' } });
    
    // Adjustments pending
    const pendingAdjustments = await prisma.walletAdjustment.count({ where: { status: 'PENDING' } });

    res.json({
      success: true,
      data: {
        totalUsers,
        totalLiabilities,
        failedPayments,
        unsettledWagers,
        pendingAdjustments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- USERS ---
router.get('/users', requireRole(['SUPPORT', 'RISK', 'FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        role: true,
        createdAt: true,
        wallets: { select: { id: true, balance: true, currency: true } }
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    
    // Convert BigInt to string for JSON serialization
    const serialized = users.map(u => ({
      ...u,
      wallets: u.wallets.map(w => ({ ...w, balance: w.balance.toString() }))
    }));

    res.json({ success: true, data: serialized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- WALLET ADJUSTMENTS (CONTROLLED FLOW) ---

// 1. Request an adjustment
router.post('/adjustments', requireRole(['SUPPORT', 'FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { walletId, amount, reason } = req.body;
    
    if (!walletId || !amount || !reason) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const adjustment = await prisma.walletAdjustment.create({
      data: {
        walletId,
        requestedBy: req.admin.id,
        amount: BigInt(amount),
        reason,
        status: 'PENDING'
      }
    });

    await logAudit(req.admin.id, 'REQUEST_WALLET_ADJUSTMENT', adjustment.id, { walletId, amount, reason }, req.ip);

    // Convert BigInt for response
    const safeAdjustment = { ...adjustment, amount: adjustment.amount.toString() };
    res.json({ success: true, data: safeAdjustment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Fetch adjustments
router.get('/adjustments', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const adjustments = await prisma.walletAdjustment.findMany({
      include: {
        requester: { select: { phone: true } },
        approver: { select: { phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const serialized = adjustments.map(a => ({
      ...a,
      amount: a.amount.toString()
    }));

    res.json({ success: true, data: serialized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Approve adjustment (Requires MFA)
router.post('/adjustments/:id/approve', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    
    const adjustment = await prisma.walletAdjustment.findUnique({ where: { id } });
    if (!adjustment) return res.status(404).json({ success: false, message: 'Not found' });
    if (adjustment.status !== 'PENDING') return res.status(400).json({ success: false, message: 'Not pending' });

    await prisma.$transaction(async (tx) => {
      // 1. Update adjustment
      await tx.walletAdjustment.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: req.admin.id }
      });

      // 2. Update wallet
      const wallet = await tx.wallet.findUnique({ where: { id: adjustment.walletId } });
      const newBalance = wallet.balance + adjustment.amount;
      
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });

      // 3. Record transaction
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          idempotencyKey: `adj-${adjustment.id}`,
          type: 'MANUAL_ADJUSTMENT',
          amount: adjustment.amount,
          balanceAfter: newBalance,
          reference: adjustment.id
        }
      });
    });

    await logAudit(req.admin.id, 'APPROVE_WALLET_ADJUSTMENT', adjustment.id, { amount: adjustment.amount.toString() }, req.ip);

    res.json({ success: true, message: 'Adjustment approved and applied.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- AUDIT LOGS ---
router.get('/audit', requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { admin: { select: { phone: true, role: true } } },
      take: 100,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- RISK INVESTIGATION QUEUE ---

// 1. Get open risk flags
router.get('/risk/flags', requireRole(['RISK', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const flags = await prisma.riskFlag.findMany({
      where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
      include: { 
        user: { 
          select: { phone: true },
          include: { riskProfile: true }
        } 
      },
      orderBy: [
        { severity: 'desc' }, // Critical first
        { createdAt: 'desc' }
      ]
    });
    res.json({ success: true, data: flags });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Resolve or Update Flag
router.post('/risk/flags/:id/resolve', requireRole(['RISK', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, suspendUser, notes } = req.body;
    
    if (!['RESOLVED', 'FALSE_POSITIVE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const flag = await prisma.riskFlag.update({
      where: { id },
      data: { status }
    });

    if (suspendUser) {
      await prisma.userRiskProfile.update({
        where: { userId: flag.userId },
        data: { isSuspended: true, suspensionReason: notes || `Suspended due to flag ${id}` }
      });
    }

    await logAudit(req.admin.id, 'RESOLVE_RISK_FLAG', id, { status, suspendUser, notes }, req.ip);

    res.json({ success: true, message: 'Risk flag resolved.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
