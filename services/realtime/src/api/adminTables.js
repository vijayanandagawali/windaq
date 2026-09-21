/**
 * adminTables.js
 * 
 * Admin Control API for Virtual Dealer Tables & Simulation Framework.
 * Strictly audited. Outcome manipulation forbidden.
 */

const express = require('express');
const router = express.Router();
const { tableManager } = require('../services/tableGames/VirtualTableManager');
const { dealerRegistry } = require('../services/dealers/VirtualDealerRegistry');
const { botFramework } = require('../services/simulation/SimulatedOpponentFramework');
const { requireRole } = require('../middleware/AdminRBAC');

const adminGuard = requireRole(['SUPER_ADMIN', 'ADMIN', 'RISK', 'FINANCE', 'SUPPORT']);

/**
 * GET /api/admin/tables
 * Returns real-time status of all continuous virtual dealer tables
 */
router.get('/', adminGuard, (req, res) => {
  try {
    const tables = tableManager.getLiveAdminOverview();
    res.json({ success: true, tables });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/tables/dealers
 * Returns all configured virtual dealer profiles
 */
router.get('/dealers', adminGuard, (req, res) => {
  try {
    const dealers = dealerRegistry.getAllDealers();
    res.json({ success: true, dealers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/tables/bots
 * Returns all simulated test bots and their states
 */
router.get('/bots', adminGuard, (req, res) => {
  try {
    const bots = botFramework.getBots();
    res.json({ success: true, bots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/admin/tables/:tableId/config
 * Update table configuration with audit trail
 */
router.patch('/:tableId/config', adminGuard, (req, res) => {
  try {
    const { tableId } = req.params;
    const updates = req.body;
    const adminUser = req.user?.username || req.user?.id || 'admin';

    const updatedTable = tableManager.updateTableConfig(tableId, updates, adminUser);
    res.json({ success: true, table: updatedTable });
  } catch (err) {
    const statusCode = err.message.includes('strictly prohibited') ? 403 : 400;
    res.status(statusCode).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/tables/:tableId/dealer
 * Reassign virtual dealer to table
 */
router.post('/:tableId/dealer', adminGuard, (req, res) => {
  try {
    const { tableId } = req.params;
    const { dealerId } = req.body;
    const adminUser = req.user?.username || req.user?.id || 'admin';

    if (!dealerId) {
      return res.status(400).json({ success: false, message: 'dealerId is required' });
    }

    const updated = tableManager.updateTableConfig(tableId, { dealerId }, adminUser);
    res.json({ success: true, table: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/tables/:tableId/simulation/toggle
 * Enable or disable bot simulation on table
 */
router.post('/:tableId/simulation/toggle', adminGuard, (req, res) => {
  try {
    const { tableId } = req.params;
    const { enabled } = req.body;
    const adminUser = req.user?.username || req.user?.id || 'admin';

    const updated = tableManager.updateTableConfig(tableId, { simulationEnabled: Boolean(enabled) }, adminUser);
    res.json({ success: true, table: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/admin/tables/simulation/bot-reconnect-test
 * Trigger bot disconnect / reconnect for resilience testing
 */
router.post('/simulation/bot-reconnect-test', adminGuard, (req, res) => {
  try {
    const { botId, action } = req.body; // action: 'disconnect' | 'reconnect' | 'timeout'
    if (!botId) return res.status(400).json({ success: false, message: 'botId required' });

    let success = false;
    if (action === 'disconnect') {
      success = botFramework.simulateDisconnect(botId);
    } else if (action === 'reconnect') {
      success = botFramework.simulateReconnect(botId);
    } else if (action === 'timeout') {
      success = botFramework.simulateTimeout(botId);
    }

    res.json({ success, bot: botFramework.getBot(botId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/tables/:tableId/audits
 * Fetch configuration audit history
 */
router.get('/:tableId/audits', adminGuard, (req, res) => {
  try {
    const { tableId } = req.params;
    const audits = tableManager.getAuditLogs(tableId);
    res.json({ success: true, audits });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
