const express = require('express');
const wagerService = require('../services/wagerService');
const router = express.Router();

router.post('/place', async (req, res) => {
  try {
    const authUserId = req.user?.userId || req.headers['x-user-id'];
    const bodyUserId = req.body?.userId;

    // IDOR Protection: authenticated non-admin players cannot place wagers for other users
    if (authUserId && bodyUserId && bodyUserId !== authUserId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        code: 'IDOR_BLOCKED',
        message: 'IDOR attempt blocked: Cannot place wager for another user.'
      });
    }

    const userId = bodyUserId && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN') 
      ? bodyUserId 
      : (authUserId || bodyUserId || 'sbx-usr-normal-001');

    const { gameType, referenceId, market, selection, type, stake, odds } = req.body;
    
    if (!gameType || !referenceId || !market || !stake || !odds) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const result = await wagerService.placeWager({
      userId,
      gameType,
      referenceId,
      market,
      selection,
      type,
      stake,
      clientOdds: odds
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Wager Place Error:", error);
    // Specifically catch Stale Odds to return a clean error to UI
    if (error.message.includes('Stale Odds')) {
       return res.status(409).json({ success: false, message: error.message, errorType: 'STALE_ODDS' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/settle', async (req, res) => {
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
