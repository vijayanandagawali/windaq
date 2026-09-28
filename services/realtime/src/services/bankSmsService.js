/**
 * Automatic UPI deposit verification without a third-party gateway.
 *
 * The merchant account holder's phone forwards the bank's "credited" SMS to POST /api/payments/bank-sms.
 * Each SMS becomes a BankCredit row (money the bank says actually arrived). A player's deposit
 * request (UTR + amount) is credited to their wallet only when it matches a BankCredit with the same
 * UTR and exactly the same amount. Either side may arrive first; whichever arrives second triggers
 * the match. Nothing is ever credited from the player's word alone.
 */

const crypto = require('crypto');
const walletService = require('./walletService');
const { PROVIDER, AWAITING_STATUS, openAmountRef } = require('./manualPaymentService');

const AUTO_REVIEWER = 'AUTO_BANK_SMS';
// A UTR submitted by a player and the bank SMS for it must be within this window of each other.
const MATCH_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Real-money deposits and withdrawals are off unless explicitly enabled. */
function isRealMoneyEnabled() {
  return process.env.REAL_MONEY_ENABLED === 'true';
}

function getPaymentConfig() {
  const upiId = (process.env.MERCHANT_UPI_ID || '').trim();
  return {
    enabled: isRealMoneyEnabled() && Boolean(upiId),
    upiId: isRealMoneyEnabled() ? upiId : '',
    payeeName: (process.env.MERCHANT_NAME || 'WinDaq').trim(),
    minDepositInr: 100,
    maxDepositInr: 100000,
    minWithdrawalInr: 200
  };
}

function allowedSenders() {
  return (process.env.BANK_SMS_SENDERS || 'SBI').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
}

/** Constant-time check of the forwarder's shared token. */
function isValidForwarderToken(provided) {
  const expected = process.env.BANK_SMS_TOKEN || '';
  if (expected.length < 32 || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function amountToPaise(raw) {
  const clean = String(raw).replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [rupees, frac = ''] = clean.split('.');
  return BigInt(rupees) * 100n + BigInt((frac + '00').slice(0, 2));
}

/**
 * Extracts { utr, amountPaise, payerName } from a bank credit SMS, or null if it is not a UPI credit.
 * Handles the common SBI formats, e.g.
 *   "Dear UPI user A/C X1234 credited by Rs500.00 on date 28Sep26 trf from JOHN D Refno 526712345678 -SBI"
 *   "Your A/c XX1234 is credited by Rs.1,000.00 on 28-09-26 (UPI Ref No 526712345678) -SBI"
 */
function parseBankSms(text) {
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  if (!/credited/i.test(body) || /debited/i.test(body)) return null;

  const amountMatch = body.match(/credited\b[^0-9]{0,40}?(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)/i)
    || body.match(/(?:Rs\.?|INR|₹)\s?([\d,]+(?:\.\d{1,2})?)[^.]{0,40}?credited/i);
  if (!amountMatch) return null;
  const amountPaise = amountToPaise(amountMatch[1]);
  if (!amountPaise || amountPaise <= 0n) return null;

  const refMatch = body.match(/(?:UPI\s*Ref(?:erence)?\.?\s*(?:No\.?|Number)?|Ref\s*No\.?|Refno|RRN|UTR(?:\s*No\.?)?)\s*[:\-]?\s*(\d{12})\b/i);
  if (!refMatch) return null;

  const payerMatch = body.match(/(?:trf|transfer)\s+from\s+([A-Za-z][A-Za-z .]{1,60}?)\s+(?:Ref|UPI|on\b|\()/i);
  return {
    utr: refMatch[1],
    amountPaise,
    payerName: payerMatch ? payerMatch[1].trim() : null
  };
}

/**
 * Matches a UTR's BankCredit to the player's deposit request and credits the wallet, atomically.
 * Safe to call any number of times and concurrently: both rows are claimed with conditional
 * updates inside one transaction, and the ledger credit has an idempotency key.
 */
async function tryMatchUtr(prisma, utr) {
  return prisma.$transaction(async (tx) => {
    const credit = await tx.bankCredit.findUnique({ where: { utr } });
    const intent = await tx.paymentIntent.findUnique({ where: { providerReference: `UTR:${utr}` } });
    if (!credit || !intent || credit.status !== 'UNMATCHED') return { matched: false };
    if (intent.type !== 'DEPOSIT' || intent.provider !== PROVIDER || intent.status !== 'PENDING_REVIEW') return { matched: false };

    if (Math.abs(credit.bankReceivedAt.getTime() - intent.createdAt.getTime()) > MATCH_WINDOW_MS) {
      return { matched: false, reason: 'OUTSIDE_WINDOW' };
    }
    if (credit.amount !== intent.amount) {
      await tx.bankCredit.updateMany({ where: { id: credit.id, status: 'UNMATCHED' }, data: { status: 'AMOUNT_MISMATCH' } });
      return { matched: false, reason: 'AMOUNT_MISMATCH' };
    }

    const claimedCredit = await tx.bankCredit.updateMany({
      where: { id: credit.id, status: 'UNMATCHED', matchedIntentId: null },
      data: { status: 'MATCHED', matchedIntentId: intent.id }
    });
    const claimedIntent = await tx.paymentIntent.updateMany({
      where: { id: intent.id, status: 'PENDING_REVIEW' },
      data: {
        status: 'SUCCESS',
        metadata: { ...(intent.metadata || {}), reviewedBy: AUTO_REVIEWER, reviewedAt: new Date().toISOString(), bankCreditId: credit.id }
      }
    });
    if (claimedCredit.count !== 1 || claimedIntent.count !== 1) {
      throw Object.assign(new Error('Concurrent match'), { code: 'CONCURRENT_MATCH' });
    }

    const credited = await walletService.creditDeposit(tx, intent.userId, intent.amount, intent.id, PROVIDER, `dep-credit-${intent.id}`);
    return { matched: true, intentId: intent.id, userId: intent.userId, amountPaise: intent.amount, transactionId: credited.transactionId };
  }).catch((err) => {
    // A concurrent caller already completed the match; that outcome stands.
    if (err.code === 'CONCURRENT_MATCH' || err.code === 'P2002' || err.code === 'P2034') return { matched: false, reason: 'ALREADY_MATCHED' };
    throw err;
  });
}

// A credit is matched by amount only if the bank received it after the deposit was started
// (small allowance for the phone's clock).
const AMOUNT_MATCH_CLOCK_SKEW_MS = 2 * 60 * 1000;

/**
 * Matches a bank credit to the waiting unique-amount deposit with exactly that amount, and credits
 * the wallet, atomically. The credit's UTR is stored on the deposit so it can never be reused.
 */
async function tryMatchAmount(prisma, utr) {
  return prisma.$transaction(async (tx) => {
    const credit = await tx.bankCredit.findUnique({ where: { utr } });
    if (!credit || credit.status !== 'UNMATCHED') return { matched: false };
    const intent = await tx.paymentIntent.findUnique({ where: { providerReference: openAmountRef(credit.amount) } });
    if (!intent || intent.type !== 'DEPOSIT' || intent.provider !== PROVIDER || intent.status !== AWAITING_STATUS) return { matched: false };
    if (credit.amount !== intent.amount) return { matched: false };
    if (credit.bankReceivedAt.getTime() < intent.createdAt.getTime() - AMOUNT_MATCH_CLOCK_SKEW_MS) {
      return { matched: false, reason: 'CREDIT_BEFORE_DEPOSIT' };
    }

    const claimedCredit = await tx.bankCredit.updateMany({
      where: { id: credit.id, status: 'UNMATCHED', matchedIntentId: null },
      data: { status: 'MATCHED', matchedIntentId: intent.id }
    });
    const claimedIntent = await tx.paymentIntent.updateMany({
      where: { id: intent.id, status: AWAITING_STATUS },
      data: {
        status: 'SUCCESS',
        providerReference: `UTR:${credit.utr}`,
        metadata: {
          ...(intent.metadata || {}),
          utr: credit.utr,
          matchedBy: 'AMOUNT',
          reviewedBy: AUTO_REVIEWER,
          reviewedAt: new Date().toISOString(),
          bankCreditId: credit.id
        }
      }
    });
    if (claimedCredit.count !== 1 || claimedIntent.count !== 1) {
      throw Object.assign(new Error('Concurrent match'), { code: 'CONCURRENT_MATCH' });
    }

    const credited = await walletService.creditDeposit(tx, intent.userId, intent.amount, intent.id, PROVIDER, `dep-credit-${intent.id}`);
    return { matched: true, intentId: intent.id, userId: intent.userId, amountPaise: intent.amount, transactionId: credited.transactionId };
  }).catch((err) => {
    if (err.code === 'CONCURRENT_MATCH' || err.code === 'P2002' || err.code === 'P2034') return { matched: false, reason: 'ALREADY_MATCHED' };
    throw err;
  });
}

/**
 * Records a forwarded bank SMS. Returns what happened, for the forwarder log.
 */
async function ingestBankSms(prisma, { sender, text, receivedAt }) {
  const from = String(sender || '').toUpperCase();
  if (!allowedSenders().some((s) => from.includes(s))) return { accepted: false, reason: 'SENDER_NOT_ALLOWED' };

  const parsed = parseBankSms(text);
  if (!parsed) {
    // Shape only, every digit masked: lets the parser be tuned to the bank's real wording
    // without logging amounts, account digits or references.
    const masked = String(text || '').replace(/\d/g, '#').slice(0, 300);
    console.warn(`[BankSMS] Unrecognised SMS from ${from}: ${masked}`);
    return { accepted: false, reason: 'NOT_A_UPI_CREDIT' };
  }

  const stamp = Number(receivedAt);
  const bankReceivedAt = Number.isFinite(stamp) && stamp > 0 ? new Date(stamp) : new Date();

  try {
    await prisma.bankCredit.create({
      data: {
        utr: parsed.utr,
        amount: parsed.amountPaise,
        sender: from.slice(0, 40),
        payerName: parsed.payerName,
        bankReceivedAt
      }
    });
  } catch (err) {
    if (err.code !== 'P2002') throw err; // duplicate SMS for the same UTR: keep the first record
  }

  // A deposit the player already submitted with this UTR wins; otherwise match by unique amount.
  let match = await tryMatchUtr(prisma, parsed.utr);
  if (!match.matched && match.reason !== 'AMOUNT_MISMATCH') {
    const byAmount = await tryMatchAmount(prisma, parsed.utr);
    if (byAmount.matched) match = byAmount;
  }
  return { accepted: true, utr: parsed.utr, amountPaise: parsed.amountPaise, ...match };
}

module.exports = {
  AUTO_REVIEWER,
  isRealMoneyEnabled,
  getPaymentConfig,
  isValidForwarderToken,
  parseBankSms,
  tryMatchUtr,
  tryMatchAmount,
  ingestBankSms
};
