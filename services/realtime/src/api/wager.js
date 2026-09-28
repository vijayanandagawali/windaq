const express = require('express');
const wagerService = require('../services/wagerService');
const router = express.Router();
const { requireRole } = require('../middleware/AdminRBAC');

// Sportsbook is not live: the only provider is a mock with simulated events and odds.
router.post('/place', (req, res) => {
  res.status(503).json({ success: false, code: 'COMING_SOON', message: 'Sports betting is coming soon.' });
});

router.post('/settle', requireRole(['RISK', 'FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    // Admin / Staff Authorization check
    if (req.user && req.user.role === 'USER') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Wager settlement requires administrative authority.'
      });
    }

    const { wagerId, status } = req.body;
    
    if (!wagerId || !status) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await wagerService.settleWager(wagerId, status);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Wager Settle Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
