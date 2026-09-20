const express = require('express');
const wagerService = require('../services/wagerService');
const router = express.Router();

router.post('/place', async (req, res) => {
  try {
    // In production, userId comes from authenticated session (JWT)
    const { userId, gameType, referenceId, market, selection, type, stake, odds } = req.body;
    
    if (!userId || !gameType || !referenceId || !market || !stake || !odds) {
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
    // In production, this would be an internal-only API or secured with an admin token
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
