const express = require('express');
const router = express.Router();
const RoundRegistry = require('../services/engine/RoundRegistry');
const { requireRole } = require('../middleware/AdminRBAC');

const adminGuard = requireRole(['SUPER_ADMIN', 'ADMIN', 'RISK', 'FINANCE', 'SUPPORT']);

/**
 * Admin Realtime Control Center API (Prompt #62)
 * 
 * Provides authorized operators with live visibility into ALL active tables,
 * countdowns, liabilities, player counts, commitment hashes, and timelines.
 */

router.get('/overview', adminGuard, (req, res) => {
  try {
    const overview = RoundRegistry.getRealtimeOverview();
    res.json(overview);
  } catch (err) {
    console.error('[AdminRealtimeAPI] Error building overview:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve realtime overview.' });
  }
});

router.get('/table/:gameId/:room', adminGuard, (req, res) => {
  try {
    const { gameId, room } = req.params;
    const engine = RoundRegistry.getEngine(gameId, room);
    if (!engine) {
      return res.status(404).json({ success: false, message: `Active table ${gameId}:${room} not found.` });
    }

    const snapshot = engine.getSnapshot('admin');
    res.json({
      success: true,
      table: {
        gameId: engine.gameId,
        variantId: engine.room,
        roundId: engine.roundId,
        sequenceNumber: engine.sequenceNumber.toString(),
        phase: engine.currentPhase,
        countdown: engine.phaseTimeLeft,
        totalPhaseDuration: engine.totalPhaseDuration,
        phaseEndsAt: engine.phaseEndsAt,
        serverTime: Date.now(),
        serverSeedHash: engine.serverSeedHash,
        resultSummary: engine.resultSummary,
        result: snapshot.result,
        history: snapshot.history,
        metrics: snapshot.metrics,
        dealer: snapshot.dealer || null,
        animationState: snapshot.animationState || null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
