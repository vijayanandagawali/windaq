const express = require('express');
const router = express.Router();
const reconciliationService = require('../services/reconciliation/WalletReconciliationService');
const { requireRole, logAudit } = require('../middleware/AdminRBAC');

/**
 * GET /api/admin/reconciliation
 * Returns reconciliation summary cards & list of recent cases
 */
router.get('/reconciliation', async (req, res) => {
  try {
    const summary = await reconciliationService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('[GET /api/admin/reconciliation Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/reconciliation/run
 * Manually trigger full ledger cross-reconciliation sweep
 */
router.post('/reconciliation/run', async (req, res) => {
  try {
    const report = await reconciliationService.runFullReconciliation();
    res.json({
      success: true,
      message: 'Automated wallet reconciliation sweep completed successfully.',
      report
    });
  } catch (error) {
    console.error('[POST /api/admin/reconciliation/run Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/reconciliation/cases/:caseId/resolve
 * Resolves a discrepancy case with mandatory audit reference
 */
router.post('/reconciliation/cases/:caseId/resolve', async (req, res) => {
  try {
    const { caseId } = req.params;
    const { resolutionReference, resolutionNote } = req.body;
    const adminId = req.user?.userId || req.headers['x-admin-user-id'] || 'SUPER_ADMIN';

    if (!resolutionReference || resolutionReference.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory resolution reference / audit reference required (minimum 3 characters).'
      });
    }

    const updated = await reconciliationService.resolveCase(
      caseId,
      resolutionReference,
      adminId,
      resolutionNote
    );

    res.json({
      success: true,
      message: `Reconciliation case ${caseId} marked as RESOLVED.`,
      data: updated
    });
  } catch (error) {
    console.error('[POST /api/admin/reconciliation/cases/:caseId/resolve Error]:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
