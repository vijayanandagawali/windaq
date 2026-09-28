const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const manualPayments = require('../services/manualPaymentService');
const bankSms = require('../services/bankSmsService');
const { requireRole, logAudit } = require('../middleware/AdminRBAC');
const { requireAuth } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FINANCE_ROLES = ['FINANCE', 'SUPER_ADMIN'];

function sendError(res, error, context) {
  if (error instanceof manualPayments.PaymentRequestError) {
    return res.status(error.status).json({ success: false, code: error.code, message: error.message });
  }
  console.error(`[Payments ${context} Error]:`, error.message);
  return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Request could not be processed.' });
}

function serializeIntent(intent) {
  return {
    ...intent,
    amount: intent.amount.toString(),
    amountInr: Number(intent.amount) / 100,
    createdAt: intent.createdAt?.toISOString?.() || intent.createdAt,
    updatedAt: intent.updatedAt?.toISOString?.() || intent.updatedAt
  };
}

// --- CLIENT ROUTES ---

// Public: whether real-money deposits are open and where to pay. Never exposes secrets.
router.get('/config', (req, res) => {
  res.json({ success: true, data: bankSms.getPaymentConfig() });
});

// Bank credit SMS forwarded from the merchant account holder's phone (see bankSmsService).
// Authenticated with a long shared token; the forwarder app sends it in the X-Windaq-Sms-Token header.
router.post('/bank-sms', async (req, res) => {
  if (!bankSms.isValidForwarderToken(req.headers['x-windaq-sms-token'])) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
  }
  try {
    const body = req.body || {};
    const result = await bankSms.ingestBankSms(prisma, {
      sender: body.from ?? body.sender ?? body.address,
      text: body.text ?? body.message ?? body.body,
      receivedAt: body.receivedStamp ?? body.sentStamp ?? body.timestamp
    });
    // The match itself is recorded on the PaymentIntent (reviewedBy AUTO_BANK_SMS) and the BankCredit row.
    if (result.matched) console.log(`[BankSMS] Auto-credited deposit ${result.intentId}`);
    res.json({
      success: true,
      accepted: result.accepted,
      reason: result.reason || null,
      matched: Boolean(result.matched)
    });
  } catch (error) {
    sendError(res, error, 'bank sms');
  }
});

// Mock-provider deposit/withdraw initiation is disabled: the only supported player flow is the
// verified manual UPI workflow (/api/ledger/deposit/instant and /api/ledger/withdraw/instant).
router.post('/deposit', requireAuth, (req, res) => {
  res.status(410).json({ success: false, code: 'FLOW_DISABLED', message: 'Use the wallet deposit flow.' });
});

router.post('/withdraw', requireAuth, (req, res) => {
  res.status(410).json({ success: false, code: 'FLOW_DISABLED', message: 'Use the wallet withdrawal flow.' });
});

// Poll intent status (owner or finance staff only)
router.get('/intent/:id', requireAuth, async (req, res) => {
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    const isStaff = FINANCE_ROLES.includes(req.user?.role);
    if (!intent || (intent.userId !== req.user.userId && !isStaff)) {
      return res.status(404).json({ success: false, message: 'Intent not found' });
    }
    res.json({ success: true, data: { status: intent.status, amount: Number(intent.amount) / 100, expiresAt: intent.metadata?.expiresAt || null } });
  } catch (error) {
    sendError(res, error, 'intent');
  }
});

// --- WEBHOOK ROUTES (PROVIDER AUTHORITATIVE) ---

router.post('/webhook/:provider', async (req, res) => {
  try {
    const provider = String(req.params.provider || '').toUpperCase();
    if (provider === 'MOCK_UPI' && process.env.NODE_ENV === 'production' && process.env.ENABLE_MOCK_PAYMENTS !== 'true') {
      return res.status(404).json({ success: false, message: 'Unknown provider' });
    }
    const signature = req.headers['x-provider-signature'];
    const result = await paymentService.handleWebhookCallback(provider, req.body, signature);
    res.json(result);
  } catch (error) {
    console.error(`[Webhook Error - ${req.params.provider}]:`, error.message);
    res.status(400).json({ success: false, message: 'Webhook rejected' });
  }
});

// --- ADMIN / FINANCE REVIEW ROUTES ---

async function listPending(type) {
  const intents = await prisma.paymentIntent.findMany({
    where: { type, status: 'PENDING_REVIEW' },
    include: { user: { select: { phone: true } } },
    orderBy: { createdAt: 'asc' }
  });
  return intents.map(serializeIntent);
}

router.get('/admin/withdrawals/pending', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    res.json({ success: true, data: await listPending('WITHDRAWAL') });
  } catch (error) {
    sendError(res, error, 'list withdrawals');
  }
});

// Bank credits that have not been matched to a deposit request (for reconciliation).
router.get('/admin/bank-credits', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    const credits = await prisma.bankCredit.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({
      success: true,
      data: credits.map((c) => ({ ...c, amount: c.amount.toString(), amountInr: Number(c.amount) / 100 }))
    });
  } catch (error) {
    sendError(res, error, 'list bank credits');
  }
});

router.get('/admin/deposits/pending', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    res.json({ success: true, data: await listPending('DEPOSIT') });
  } catch (error) {
    sendError(res, error, 'list deposits');
  }
});

function reviewNote(req) {
  const note = String(req.body?.note || '').trim().slice(0, 500);
  return note || null;
}

// Approve withdrawal: finance confirms the payout was sent, then the hold is finalized.
router.post('/admin/withdrawals/:id/approve', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: req.params.id } });
    if (intent && intent.provider !== manualPayments.PROVIDER) {
      // Legacy adapter-based intents keep their original flow.
      await paymentService.approveWithdrawal(req.params.id, req.admin.id);
    } else {
      const note = reviewNote(req);
      if (!note) return res.status(400).json({ success: false, code: 'NOTE_REQUIRED', message: 'Enter the payout reference (UTR) used to pay this withdrawal.' });
      await manualPayments.approveWithdrawal(prisma, req.params.id, req.admin.id, note);
    }
    await logAudit(req.admin.id, 'APPROVE_WITHDRAWAL', req.params.id, { note: reviewNote(req) }, req.ip);
    res.json({ success: true, message: 'Withdrawal marked as paid.' });
  } catch (error) {
    sendError(res, error, 'approve withdrawal');
  }
});

router.post('/admin/withdrawals/:id/reject', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    const note = reviewNote(req);
    if (!note) return res.status(400).json({ success: false, code: 'NOTE_REQUIRED', message: 'A rejection reason is required.' });
    await manualPayments.rejectWithdrawal(prisma, req.params.id, req.admin.id, note);
    await logAudit(req.admin.id, 'REJECT_WITHDRAWAL', req.params.id, { note }, req.ip);
    res.json({ success: true, message: 'Withdrawal rejected and funds returned to the player.' });
  } catch (error) {
    sendError(res, error, 'reject withdrawal');
  }
});

// Approve deposit: finance confirms the UTR on the bank statement, then the wallet is credited.
router.post('/admin/deposits/:id/approve', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    const result = await manualPayments.approveDeposit(prisma, req.params.id, req.admin.id, reviewNote(req));
    await logAudit(req.admin.id, 'APPROVE_DEPOSIT', req.params.id, { note: reviewNote(req), transactionId: result.transactionId }, req.ip);
    res.json({ success: true, message: 'Deposit verified and credited.', data: { transactionId: result.transactionId } });
  } catch (error) {
    sendError(res, error, 'approve deposit');
  }
});

router.post('/admin/deposits/:id/reject', requireAuth, requireRole(FINANCE_ROLES), async (req, res) => {
  try {
    const note = reviewNote(req);
    if (!note) return res.status(400).json({ success: false, code: 'NOTE_REQUIRED', message: 'A rejection reason is required.' });
    await manualPayments.rejectDeposit(prisma, req.params.id, req.admin.id, note);
    await logAudit(req.admin.id, 'REJECT_DEPOSIT', req.params.id, { note }, req.ip);
    res.json({ success: true, message: 'Deposit rejected.' });
  } catch (error) {
    sendError(res, error, 'reject deposit');
  }
});

module.exports = router;
