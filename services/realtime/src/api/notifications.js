const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { ensureUserAndWallet } = require('../services/walletService');
const prisma = new PrismaClient();
const notificationService = require('../services/notificationService');

// Admin: View Notification Logs
router.get('/admin/logs', async (req, res) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { phone: true, id: true } }
      }
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Retry failed notification
router.post('/admin/retry/:logId', async (req, res) => {
  try {
    const log = await prisma.notificationLog.findUnique({ where: { id: req.params.logId } });
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    if (log.status !== 'FAILED') return res.status(400).json({ success: false, message: 'Can only retry failed notifications' });

    // In a real system, you'd extract variables from the payload (if stored fully), but since we redacted them, 
    // a true retry mechanism requires a separate Retry Queue holding unredacted payloads securely.
    // For this prototype, we'll just simulate a ping.
    
    res.json({ success: true, message: 'Retry initiated (Mock)' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const { requireAuth } = require('../middleware/auth');

// User: Update Preferences
router.post('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-user-id'];
    const { marketingEmail, marketingSms, transactionalInApp } = req.body;

    await ensureUserAndWallet(prisma, userId);

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId },
      update: { marketingEmail, marketingSms, transactionalInApp },
      create: { userId, marketingEmail, marketingSms, transactionalInApp }
    });

    res.json({ success: true, data: prefs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
