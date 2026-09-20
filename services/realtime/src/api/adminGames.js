const express = require('express');
const router = express.Router();
const adminGameConfigService = require('../services/adminGameConfigService');
const { requireRole } = require('../middleware/AdminRBAC');

// Ensure service is initialized
adminGameConfigService.initialize().catch(err => {
  console.error('[AdminGames API] Failed to initialize AdminGameConfigService:', err);
});

/**
 * GET /api/admin/games
 * Returns all games with active configurations, limits, status, and active payout versions
 */
router.get('/', requireRole(['SUPPORT', 'RISK', 'FINANCE', 'SUPER_ADMIN']), (req, res) => {
  try {
    const games = adminGameConfigService.getAllGameConfigs();
    res.json({
      success: true,
      data: games
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/games/audits/all
 * Returns all audit logs across all games
 */
router.get('/audits/all', requireRole(['SUPPORT', 'RISK', 'FINANCE', 'SUPER_ADMIN']), (req, res) => {
  try {
    const audits = adminGameConfigService.getAudits();
    res.json({
      success: true,
      data: audits
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/games/:slug
 * Returns detailed config, variants, payout rules, version history, and audit log for a single game
 */
router.get('/:slug', requireRole(['SUPPORT', 'RISK', 'FINANCE', 'SUPER_ADMIN']), (req, res) => {
  try {
    const { slug } = req.params;
    const game = adminGameConfigService.getGameConfig(slug);
    if (!game) {
      return res.status(404).json({ success: false, message: `Game '${slug}' not found.` });
    }
    const audits = adminGameConfigService.getAudits(slug);
    res.json({
      success: true,
      data: {
        ...game,
        audits
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/admin/games/:slug/config
 * Update general game configuration: enable/disable, maintenance, limits, durations, dealer speed, visibility, variants
 */
router.patch('/:slug/config', requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { slug } = req.params;
    const updates = req.body;
    const adminId = req.admin?.id || req.headers['x-admin-user-id'] || 'SUPER_ADMIN_DEMO_001';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const result = await adminGameConfigService.updateGameConfig(slug, updates, adminId, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/games/:slug/payout-rules
 * Deploy a new versioned payout rule set
 * Mandatory: rules (object) and reason (string)
 */
router.post('/:slug/payout-rules', requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { slug } = req.params;
    const { rules, reason } = req.body;
    const adminId = req.admin?.id || req.headers['x-admin-user-id'] || 'SUPER_ADMIN_DEMO_001';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ success: false, message: 'Rules object is required.' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'A mandatory explanation reason (min 3 chars) is required for versioned payout rule deployments.' 
      });
    }

    const result = await adminGameConfigService.deployPayoutVersion(slug, rules, reason, adminId, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/games/:slug/variants/:variantId/toggle
 * Quick toggle for a specific variant
 */
router.post('/:slug/variants/:variantId/toggle', requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { slug, variantId } = req.params;
    const { isEnabled } = req.body;
    const adminId = req.admin?.id || req.headers['x-admin-user-id'] || 'SUPER_ADMIN_DEMO_001';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    const result = await adminGameConfigService.toggleVariant(slug, variantId, isEnabled, adminId, ipAddress);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/games/:slug/audits
 * Get audit records for a game
 */
router.get('/:slug/audits', requireRole(['SUPPORT', 'RISK', 'FINANCE', 'SUPER_ADMIN']), (req, res) => {
  try {
    const { slug } = req.params;
    const audits = adminGameConfigService.getAudits(slug);
    res.json({
      success: true,
      data: audits
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
