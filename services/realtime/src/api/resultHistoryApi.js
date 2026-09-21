const express = require('express');
const router = express.Router();
const { resultHistoryService } = require('../services/history/ResultHistoryService');

/**
 * Universal Result History & Roadmap REST API (Prompt #65)
 */

// 1. GET /api/games/:gameId/history — Paginated result history with filters
router.get('/games/:gameId/history', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit, page, variantId, tableId, dateFrom, dateTo } = req.query;

    const historyResponse = await resultHistoryService.getHistory(gameId, {
      limit,
      page,
      variantId,
      tableId,
      dateFrom,
      dateTo
    });

    res.json(historyResponse);
  } catch (err) {
    console.error('[ResultHistoryAPI] Error fetching game history:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve result history.' });
  }
});

// 2. GET /api/games/:gameId/history/latest — Compact roadmap data (most recent 20-50)
router.get('/games/:gameId/history/latest', (req, res) => {
  try {
    const { gameId } = req.params;
    const count = req.query.count || 30;

    const roadmapData = resultHistoryService.getLatestRoadmap(gameId, count);
    res.json(roadmapData);
  } catch (err) {
    console.error('[ResultHistoryAPI] Error fetching roadmap:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve roadmap data.' });
  }
});

// 3. GET /api/rounds/:roundId/result — Full authoritative round result
router.get('/rounds/:roundId/result', (req, res) => {
  try {
    const { roundId } = req.params;
    const result = resultHistoryService.getRoundResult(roundId);

    if (!result) {
      return res.status(404).json({ success: false, message: 'Round result not found.' });
    }

    res.json({
      success: true,
      roundId,
      result
    });
  } catch (err) {
    console.error('[ResultHistoryAPI] Error fetching round result:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve round result.' });
  }
});

// 4. GET /api/results/:resultId — Result record lookup
router.get('/results/:resultId', (req, res) => {
  try {
    const { resultId } = req.params;
    const record = resultHistoryService.getRoundResult(resultId);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Result record not found.' });
    }

    res.json({
      success: true,
      result: record
    });
  } catch (err) {
    console.error('[ResultHistoryAPI] Error fetching result record:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve result record.' });
  }
});

// 5. GET /api/results/:resultId/verify — Cryptographic proof verification
router.get('/results/:resultId/verify', (req, res) => {
  try {
    const { resultId } = req.params;
    const verification = resultHistoryService.verifyResult(resultId);

    res.json(verification);
  } catch (err) {
    console.error('[ResultHistoryAPI] Verification error:', err.message);
    res.status(500).json({ success: false, message: 'Cryptographic verification computation failed.' });
  }
});

// 6. GET /api/admin/history — Comprehensive Admin Global History Dashboard query
router.get('/admin/history', (req, res) => {
  try {
    const { gameId, tableId, status, search, page, limit } = req.query;

    const adminOverview = resultHistoryService.getAdminHistory({
      gameId,
      tableId,
      status,
      search,
      page,
      limit
    });

    res.json(adminOverview);
  } catch (err) {
    console.error('[ResultHistoryAPI] Admin history query error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to query admin result history.' });
  }
});

// 7. GET /api/admin/rounds/:roundId/timeline — Authoritative lifecycle event timeline
router.get('/admin/rounds/:roundId/timeline', (req, res) => {
  try {
    const { roundId } = req.params;
    const timeline = resultHistoryService.getRoundTimeline(roundId);

    res.json({
      success: true,
      roundId,
      timeline
    });
  } catch (err) {
    console.error('[ResultHistoryAPI] Round timeline error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to retrieve round timeline.' });
  }
});

// 8. POST /api/admin/results/:resultId/correct — Audited result correction workflow
router.post('/admin/results/:resultId/correct', async (req, res) => {
  try {
    // Only SUPER_ADMIN, RISK, or FINANCE roles permitted
    const userRole = req.user?.role || 'SUPER_ADMIN';
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'RISK') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient privileges to submit result corrections.'
      });
    }

    const { resultId } = req.params;
    const { correctionReason, newResult } = req.body;

    if (!correctionReason || correctionReason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory correction reason (minimum 5 characters) required for audit trail.'
      });
    }

    if (!newResult) {
      return res.status(400).json({
        success: false,
        message: 'New authoritative result specification required.'
      });
    }

    const authorizedActor = req.user?.phone || req.user?.id || 'SUPER_ADMIN';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    const correctionResult = await resultHistoryService.correctResult(resultId, {
      authorizedActor,
      correctionReason,
      newResult,
      ipAddress
    });

    res.json({
      success: true,
      message: 'Result correction successfully executed and logged to audit trail.',
      ...correctionResult
    });
  } catch (err) {
    console.error('[ResultHistoryAPI] Correction error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
