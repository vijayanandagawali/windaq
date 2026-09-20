const express = require('express');
const router = express.Router();
const mockProvider = require('../services/sports/MockSportsProvider');
const wagerService = require('../services/wagerService');

/**
 * ADMIN API: Requires RBAC checks (omitted for brevity)
 */

// 1. Get live events
router.get('/events', async (req, res) => {
  try {
    const events = await mockProvider.fetchLiveEvents();
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Suspend/Resume Market
router.post('/market/status', async (req, res) => {
  try {
    const { eventId, marketId, status } = req.body;
    // Update local cache/provider
    if (status === 'SUSPENDED') {
      mockProvider.simulateSuspension(eventId, marketId);
    }
    // TODO: Actually persist to Postgres SportMarket if we mirrored it
    res.json({ success: true, message: `Market ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Simulate Provider Odds Change
router.post('/simulate/odds', async (req, res) => {
  try {
    const { eventId, selectionId, oddsBack } = req.body;
    mockProvider.simulateOddsChange(eventId, selectionId, oddsBack);
    res.json({ success: true, message: `Odds updated to ${oddsBack}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Manual Settlement / Void (Admin Control)
router.post('/settle', async (req, res) => {
  try {
    const { wagerId, status } = req.body; // WON, LOST, VOID, CANCELLED
    const result = await wagerService.settleWager(wagerId, status);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
