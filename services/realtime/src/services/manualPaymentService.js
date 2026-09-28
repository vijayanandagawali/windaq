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

// --- Unique-amount deposits -------------------------------------------------------------------
//
// The player picks whole rupees; the server adds 1–99 paise so the exact amount (e.g. ₹200.37)
// identifies this deposit. The bank's credit SMS carries the amount, so the deposit can be matched
// without the player typing a UTR. While a deposit waits for payment its providerReference is
// `AMTOPEN:<paise>`: the unique index guarantees no two open deposits share an amount.

const AWAITING_STATUS = 'AWAITING_PAYMENT';
const AWAIT_TTL_MS = 30 * 60 * 1000;
const MAX_OPEN_DEPOSITS_PER_USER = 3;
const openAmountRef = (paise) => `AMTOPEN:${paise}`;

function isUniqueViolation(err) {
  return err && (err.code === 'P2002' || /Unique constraint/i.test(err.message || ''));
}

/** Expires waiting deposits older than the TTL, freeing their amount and pending balance. */
async function expireStaleDeposits(prisma, now = new Date()) {
  const stale = await prisma.paymentIntent.findMany({
    where: { type: 'DEPOSIT', provider: PROVIDER, status: AWAITING_STATUS, createdAt: { lt: new Date(now.getTime() - AWAIT_TTL_MS) } },
    select: { id: true },
    take: 200
  });
  let expired = 0;
  for (const { id } of stale) {
    await prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.findUnique({ where: { id } });
      const claimed = await tx.paymentIntent.updateMany({
        where: { id, status: AWAITING_STATUS },
        data: { status: 'EXPIRED', providerReference: `AMTEXP:${id}` }
      });
      if (claimed.count === 1) {
        await releasePendingDeposit(tx, intent.userId, intent.amount);
        expired += 1;
      }
    });
  }
  return expired;
}

/**
 * Starts a deposit: reserves a unique amount (requested rupees + 1–99 paise) for 30 minutes.
 * Asking again for the same rupee amount returns the player's still-open deposit.
 */
async function startDeposit(prisma, user, { amount }) {
  assertRealMoneyAccount(user);
  const requestedPaise = toPaise(amount);
  if (requestedPaise % 100n !== 0n) throw new PaymentRequestError('INVALID_AMOUNT', 'Enter a whole rupee amount.');
  if (requestedPaise < MIN_DEPOSIT_PAISE) throw new PaymentRequestError('AMOUNT_TOO_LOW', `Minimum deposit is ₹${formatInr(MIN_DEPOSIT_PAISE)}.`);
  if (requestedPaise > MAX_DEPOSIT_PAISE) throw new PaymentRequestError('AMOUNT_TOO_HIGH', `Maximum deposit is ₹${formatInr(MAX_DEPOSIT_PAISE)}.`);

  await expireStaleDeposits(prisma);

  const open = await prisma.paymentIntent.findMany({
    where: { userId: user.userId, type: 'DEPOSIT', provider: PROVIDER, status: AWAITING_STATUS },
    orderBy: { createdAt: 'desc' }
  });
  const same = open.find((i) => BigInt(i.metadata?.requestedPaise ?? -1) === requestedPaise);
  if (same) return { intent: same, reused: true };
  if (open.length >= MAX_OPEN_DEPOSITS_PER_USER) {
    throw new PaymentRequestError('TOO_MANY_OPEN_DEPOSITS', 'You already have deposits waiting for payment. Complete or wait for them to expire.', 429);
  }

  await walletService.ensureUserAndWallet(prisma, user.userId, { initialPaise: 0n });

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const taken = await prisma.paymentIntent.findMany({
      where: { status: AWAITING_STATUS, amount: { gt: requestedPaise, lt: requestedPaise + 100n } },
      select: { amount: true }
    });
    const used = new Set(taken.map((t) => Number(t.amount - requestedPaise)));
    const free = [];
    for (let p = 1; p <= 99; p += 1) if (!used.has(p)) free.push(p);
    if (free.length === 0) {
      throw new PaymentRequestError('AMOUNT_BUSY', 'Many deposits of this amount are in progress. Try a slightly different amount.', 409);
    }
    const amountPaise = requestedPaise + BigInt(free[crypto.randomInt(free.length)]);
    const expiresAt = new Date(Date.now() + AWAIT_TTL_MS);
    try {
      const intent = await prisma.$transaction(async (tx) => {
        const created = await tx.paymentIntent.create({
          data: {
            userId: user.userId,
            amount: amountPaise,
            type: 'DEPOSIT',
            provider: PROVIDER,
            providerReference: openAmountRef(amountPaise),
            status: AWAITING_STATUS,
            metadata: { requestedPaise: requestedPaise.toString(), expiresAt: expiresAt.toISOString(), startedAt: new Date().toISOString() }
          }
        });
        await tx.wallet.updateMany({ where: { userId: user.userId, currency: 'INR' }, data: { pendingDeposit: { increment: amountPaise } } });
        return created;
      });
      return { intent, reused: false };
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // someone took this amount a moment ago: pick another
    }
  }
  throw new PaymentRequestError('AMOUNT_BUSY', 'Could not reserve a deposit amount. Please try again.', 409);
}

/**
 * Backup path: the player enters the UTR for a unique-amount deposit (e.g. the SMS never arrived
 * or they paid late). The deposit then waits for the bank credit with that UTR, or for finance.
 */
async function attachDepositUtr(prisma, user, intentId, utr) {
  assertRealMoneyAccount(user);
  const cleanUtr = String(utr || '').trim().toUpperCase();
  if (!UTR_PATTERN.test(cleanUtr)) {
    throw new PaymentRequestError('UTR_REQUIRED', 'Enter the 12-digit UPI reference (UTR) from your payment app.');
  }
  const intent = await prisma.paymentIntent.findUnique({ where: { id: String(intentId || '') } });
  if (!intent || intent.userId !== user.userId || intent.type !== 'DEPOSIT' || intent.provider !== PROVIDER) {
    throw new PaymentRequestError('NOT_FOUND', 'Deposit not found.', 404);
  }
  if (intent.status === 'SUCCESS' || intent.status === 'PENDING_REVIEW') return { intent, duplicate: true };
  if (![AWAITING_STATUS, 'EXPIRED'].includes(intent.status)) {
    throw new PaymentRequestError('ALREADY_PROCESSED', 'This deposit has already been processed.', 409);
  }

  const usedBy = await prisma.paymentIntent.findUnique({ where: { providerReference: `UTR:${cleanUtr}` } });
  if (usedBy) throw new PaymentRequestError('UTR_ALREADY_USED', 'This UTR has already been submitted.', 409);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.paymentIntent.updateMany({
        where: { id: intent.id, status: intent.status },
        data: {
          status: 'PENDING_REVIEW',
          providerReference: `UTR:${cleanUtr}`,
          metadata: { ...(intent.metadata || {}), utr: cleanUtr, submittedAt: new Date().toISOString() }
        }
      });
      if (claimed.count !== 1) throw new PaymentRequestError('ALREADY_PROCESSED', 'This deposit changed while you were submitting. Please check your wallet.', 409);
      // An expired deposit had released its pending amount; it is pending again now.
      if (intent.status === 'EXPIRED') {
        await tx.wallet.updateMany({ where: { userId: intent.userId, currency: 'INR' }, data: { pendingDeposit: { increment: intent.amount } } });
      }
      return tx.paymentIntent.findUnique({ where: { id: intent.id } });
    });
    return { intent: updated, duplicate: false };
  } catch (err) {
    if (isUniqueViolation(err)) throw new PaymentRequestError('UTR_ALREADY_USED', 'This UTR has already been submitted.', 409);
    throw err;
  }
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
  AWAITING_STATUS,
  AWAIT_TTL_MS,
  openAmountRef,
  toPaise,
  createDepositRequest,
  startDeposit,
  attachDepositUtr,
  expireStaleDeposits,
  createWithdrawalRequest,
  approveDeposit,
  rejectDeposit,
  approveWithdrawal,
  rejectWithdrawal
};
