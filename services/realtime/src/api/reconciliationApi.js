const express = require('express');
const router = express.Router();
const reconciliationService = require('../services/reconciliation/WalletReconciliationService');
const { requireRole, logAudit } = require('../middleware/AdminRBAC');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /api/admin/reconciliation
 * Returns reconciliation summary cards & list of recent cases
 */
router.get('/reconciliation', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const summary = await reconciliationService.getDashboardSummary();
    res.json(summary);
  } catch (error) {
    console.error('[GET /api/admin/reconciliation Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const OPEN_MISMATCH_STATUSES = ['MISSING_LEDGER', 'MISSING_PAYMENT', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'DUPLICATE_PAYMENT', 'DUPLICATE_LEDGER', 'UNKNOWN_REFERENCE'];

/**
 * GET /api/admin/reconciliation/summary
 * Cards for the reconciliation console (amounts in rupees).
 */
router.get('/reconciliation/summary', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const [totalWallets, totalTransactions, pendingCount, manualReviewCount, resolvedCount, mismatchCount, openCases] = await Promise.all([
      prisma.wallet.count(),
      prisma.ledgerTransaction.count(),
      prisma.reconciliationCase.count({ where: { status: 'PENDING' } }),
      prisma.reconciliationCase.count({ where: { status: 'MANUAL_REVIEW_REQUIRED' } }),
      prisma.reconciliationCase.count({ where: { status: 'RESOLVED' } }),
      prisma.reconciliationCase.count({ where: { status: { in: OPEN_MISMATCH_STATUSES } } }),
      prisma.reconciliationCase.findMany({ where: { status: { notIn: ['RESOLVED', 'MATCHED'] } }, select: { userId: true, difference: true } })
    ]);
    const walletsWithIssues = new Set(openCases.map((c) => c.userId).filter(Boolean)).size;
    const discrepancyPaise = openCases.reduce((sum, c) => sum + BigInt(c.difference || 0n), 0n);
    res.json({
      success: true,
      data: {
        totalWallets,
        totalTransactions,
        matchedCount: Math.max(0, totalWallets - walletsWithIssues),
        mismatchCount,
        pendingCount,
        manualReviewCount,
        resolvedCount,
        totalSystemDiscrepancy: Number(discrepancyPaise) / 100
      }
    });
  } catch (error) {
    console.error('[GET /api/admin/reconciliation/summary Error]:', error.message);
    res.status(500).json({ success: false, message: 'Summary could not be loaded.' });
  }
});

/**
 * GET /api/admin/reconciliation/cases?status=ALL|<status>
 */
router.get('/reconciliation/cases', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const status = String(req.query.status || 'ALL');
    const cases = await prisma.reconciliationCase.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    const rupees = (paise) => Number(paise || 0n) / 100;
    res.json({
      success: true,
      data: cases.map((c) => ({
        id: c.id,
        caseId: c.caseId,
        userId: c.userId,
        referenceId: c.referenceId,
        provider: c.provider,
        expectedAmount: rupees(c.expectedAmount),
        actualAmount: rupees(c.walletAmount),
        ledgerAmount: rupees(c.ledgerAmount),
        difference: rupees(c.difference),
        status: c.status,
        reason: c.reason,
        createdAt: c.createdAt.toISOString(),
        resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
        resolvedBy: c.resolvedBy,
        resolutionReference: c.resolutionReference
      }))
    });
  } catch (error) {
    console.error('[GET /api/admin/reconciliation/cases Error]:', error.message);
    res.status(500).json({ success: false, message: 'Cases could not be loaded.' });
  }
});

/**
 * POST /api/admin/reconciliation/run
 * Manually trigger full ledger cross-reconciliation sweep
 */
router.post('/reconciliation/run', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const report = await reconciliationService.runFullReconciliation();
    res.json({
      success: true,
      message: 'Automated wallet reconciliation sweep completed successfully.',
      data: {
        walletsChecked: report.totalWallets,
        discrepanciesFound: report.totalDiscrepancies,
        mismatchedWallets: report.mismatchedWallets,
        timestamp: report.timestamp
      }
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
router.post('/reconciliation/cases/:caseId/resolve', requireRole(['FINANCE', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { caseId } = req.params;
    const { resolutionReference } = req.body;
    const resolutionNote = req.body.resolutionNote ?? req.body.notes;
    const adminId = req.user.userId;

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
