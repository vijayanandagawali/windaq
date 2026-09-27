/**
 * Manual UPI payment workflow (containment until a real gateway with webhooks is integrated).
 *
 * Deposits:    player submits amount + UTR  -> PaymentIntent PENDING_REVIEW (no balance change)
 *              finance approves after verifying the bank statement -> ledgered credit
 * Withdrawals: player requests payout      -> funds locked (ledger hold) + PENDING_REVIEW
 *              finance pays out manually and approves -> hold finalized
 *              finance rejects             -> hold reverted to available balance
 *
 * Every state transition uses a conditional update (status must still be PENDING_REVIEW) inside
 * the same DB transaction as the wallet mutation, so a request can never be processed twice.
 */

const crypto = require('crypto');
const walletService = require('./walletService');

const PROVIDER = 'MANUAL_UPI';
const MIN_DEPOSIT_PAISE = 10000n;     // ₹100
const MAX_DEPOSIT_PAISE = 10000000n;  // ₹1,00,000
const MIN_WITHDRAWAL_PAISE = 20000n;  // ₹200
const MAX_WITHDRAWAL_PAISE = 10000000n;
const UTR_PATTERN = /^[A-Za-z0-9]{8,30}$/;
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$/;

class PaymentRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Parses a rupee amount into integer paise. Rejects NaN, negatives and >2 decimals.
 */
function toPaise(amount) {
  const str = String(amount ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) throw new PaymentRequestError('INVALID_AMOUNT', 'Enter a valid amount (up to 2 decimal places).');
  const [rupees, frac = ''] = str.split('.');
  return BigInt(rupees) * 100n + BigInt((frac + '00').slice(0, 2));
}

function assertRealMoneyAccount(user) {
  if (!user || user.isGuest || String(user.userId || '').startsWith('sbx_guest_')) {
    throw new PaymentRequestError('GUEST_NOT_ALLOWED', 'Guest test accounts cannot deposit or withdraw. Please sign in with your mobile number.', 403);
  }
}

function formatInr(paise) {
  return (Number(paise) / 100).toFixed(2);
}

async function createDepositRequest(prisma, user, { amount, utr }) {
  assertRealMoneyAccount(user);
  const amountPaise = toPaise(amount);
  if (amountPaise < MIN_DEPOSIT_PAISE) throw new PaymentRequestError('AMOUNT_TOO_LOW', `Minimum deposit is ₹${formatInr(MIN_DEPOSIT_PAISE)}.`);
  if (amountPaise > MAX_DEPOSIT_PAISE) throw new PaymentRequestError('AMOUNT_TOO_HIGH', `Maximum deposit is ₹${formatInr(MAX_DEPOSIT_PAISE)}.`);

  const cleanUtr = String(utr || '').trim().toUpperCase();
  if (!UTR_PATTERN.test(cleanUtr)) {
    throw new PaymentRequestError('UTR_REQUIRED', 'Enter the 12-digit UPI reference (UTR) from your payment app after paying.');
  }

  const existing = await prisma.paymentIntent.findUnique({ where: { providerReference: `UTR:${cleanUtr}` } });
  if (existing) {
    if (existing.userId === user.userId && existing.amount === amountPaise && existing.type === 'DEPOSIT') {
      return { intent: existing, duplicate: true };
    }
    throw new PaymentRequestError('UTR_ALREADY_USED', 'This UTR has already been submitted.', 409);
  }

  await walletService.ensureUserAndWallet(prisma, user.userId, { initialPaise: 0n });
  const intent = await prisma.paymentIntent.create({
    data: {
      userId: user.userId,
      amount: amountPaise,
      type: 'DEPOSIT',
      provider: PROVIDER,
      providerReference: `UTR:${cleanUtr}`,
      status: 'PENDING_REVIEW',
      metadata: { utr: cleanUtr, submittedAt: new Date().toISOString() }
    }
  });

  await prisma.wallet.updateMany({
    where: { userId: user.userId, currency: 'INR' },
    data: { pendingDeposit: { increment: amountPaise } }
  });

  return { intent, duplicate: false };
}

async function createWithdrawalRequest(prisma, user, { amount, upiId, idempotencyKey }) {
  assertRealMoneyAccount(user);
  const amountPaise = toPaise(amount);
  if (amountPaise < MIN_WITHDRAWAL_PAISE) throw new PaymentRequestError('AMOUNT_TOO_LOW', `Minimum withdrawal is ₹${formatInr(MIN_WITHDRAWAL_PAISE)}.`);
  if (amountPaise > MAX_WITHDRAWAL_PAISE) throw new PaymentRequestError('AMOUNT_TOO_HIGH', `Maximum withdrawal is ₹${formatInr(MAX_WITHDRAWAL_PAISE)}.`);

  const cleanUpi = String(upiId || '').trim();
  if (!UPI_ID_PATTERN.test(cleanUpi)) throw new PaymentRequestError('INVALID_UPI', 'Please enter a valid UPI ID (e.g. name@okhdfcbank).');

  const key = String(idempotencyKey || '').trim();
  const reference = key && /^[A-Za-z0-9_-]{8,80}$/.test(key)
    ? `WDR-${user.userId}-${key}`
    : `WDR-${crypto.randomUUID()}`;

  const existing = await prisma.paymentIntent.findUnique({ where: { providerReference: reference } });
  if (existing) return { intent: existing, duplicate: true };

  const intent = await prisma.$transaction(async (tx) => {
    const kyc = await tx.kycProfile.findUnique({ where: { userId: user.userId } }).catch(() => null);
    await walletService.lockFundsForWithdrawal(tx, user.userId, amountPaise, reference, cleanUpi);
    return tx.paymentIntent.create({
      data: {
        userId: user.userId,
        amount: amountPaise,
        type: 'WITHDRAWAL',
        provider: PROVIDER,
        providerReference: reference,
        status: 'PENDING_REVIEW',
        metadata: { destination: cleanUpi, holdReference: reference, kycStatus: kyc?.status || 'PENDING' }
      }
    });
  });

  return { intent, duplicate: false };
}

/**
 * Atomically moves an intent out of PENDING_REVIEW. Returns the intent or throws if another
 * operator already processed it.
 */
async function claimIntent(tx, intentId, type, nextStatus, adminId, note) {
  const intent = await tx.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent || intent.type !== type || intent.provider !== PROVIDER) {
    throw new PaymentRequestError('NOT_FOUND', 'Payment request not found.', 404);
  }
  const claimed = await tx.paymentIntent.updateMany({
    where: { id: intentId, status: 'PENDING_REVIEW' },
    data: {
      status: nextStatus,
      metadata: { ...(intent.metadata || {}), reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNote: note || null }
    }
  });
  if (claimed.count !== 1) {
    throw new PaymentRequestError('ALREADY_PROCESSED', `This request has already been processed (status: ${intent.status}).`, 409);
  }
  return intent;
}

async function releasePendingDeposit(tx, userId, amountPaise) {
  const wallet = await tx.wallet.findFirst({ where: { userId, currency: 'INR' } });
  if (!wallet) return;
  const next = BigInt(wallet.pendingDeposit || 0n) >= amountPaise ? BigInt(wallet.pendingDeposit) - amountPaise : 0n;
  await tx.wallet.update({ where: { id: wallet.id }, data: { pendingDeposit: next } });
}

async function approveDeposit(prisma, intentId, adminId, note) {
  return prisma.$transaction(async (tx) => {
    const intent = await claimIntent(tx, intentId, 'DEPOSIT', 'SUCCESS', adminId, note);
    // creditDeposit also releases pendingDeposit for this amount.
    const credited = await walletService.creditDeposit(
      tx, intent.userId, intent.amount, intent.id, PROVIDER, `dep-credit-${intent.id}`
    );
    return { intentId: intent.id, userId: intent.userId, amountPaise: intent.amount, transactionId: credited.transactionId };
  });
}

async function rejectDeposit(prisma, intentId, adminId, note) {
  return prisma.$transaction(async (tx) => {
    const intent = await claimIntent(tx, intentId, 'DEPOSIT', 'FAILED', adminId, note);
    await releasePendingDeposit(tx, intent.userId, intent.amount);
    return { intentId: intent.id, userId: intent.userId };
  });
}

async function approveWithdrawal(prisma, intentId, adminId, note) {
  return prisma.$transaction(async (tx) => {
    const intent = await claimIntent(tx, intentId, 'WITHDRAWAL', 'SUCCESS', adminId, note);
    await walletService.finalizeWithdrawal(tx, intent.userId, intent.amount, intent.metadata.holdReference);
    return { intentId: intent.id, userId: intent.userId, amountPaise: intent.amount };
  });
}

async function rejectWithdrawal(prisma, intentId, adminId, note) {
  return prisma.$transaction(async (tx) => {
    const intent = await claimIntent(tx, intentId, 'WITHDRAWAL', 'FAILED', adminId, note);
    await walletService.revertWithdrawalHold(tx, intent.userId, intent.amount, intent.metadata.holdReference, note || 'Rejected by finance');
    return { intentId: intent.id, userId: intent.userId };
  });
}

module.exports = {
  PaymentRequestError,
  PROVIDER,
  toPaise,
  createDepositRequest,
  createWithdrawalRequest,
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal
};
