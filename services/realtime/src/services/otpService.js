/**
 * Server-side OTP issuance & verification (database-backed, works across restarts and instances).
 *
 * - OTPs are generated with crypto.randomInt and stored only as SHA-256 hashes (OtpChallenge).
 * - OTP values are never logged or returned in API responses.
 * - Max 5 verification attempts per code, 5-minute expiry, 30-second resend cooldown.
 * - Attempt counting is an atomic conditional update, so parallel guesses cannot exceed the limit.
 * - A fixed development OTP is honoured ONLY when NODE_ENV !== 'production' and DEV_FIXED_OTP is
 *   explicitly configured (NODE_ENV=test defaults it to 1234 for test suites).
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(phone, otp) {
  return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
}

function getDevFixedOtp() {
  if (process.env.NODE_ENV === 'production') return null;
  if (process.env.DEV_FIXED_OTP) return String(process.env.DEV_FIXED_OTP);
  if (process.env.NODE_ENV === 'test') return '1234';
  return null;
}

async function sendViaFast2Sms(phoneE164, otp) {
  // Automated tests must never reach a real SMS provider.
  if (process.env.WINDAQ_TEST_HARNESS === '1') return { delivered: false, reason: 'SMS_PROVIDER_NOT_CONFIGURED' };
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return { delivered: false, reason: 'SMS_PROVIDER_NOT_CONFIGURED' };

  const digits10 = phoneE164.replace(/\D/g, '').slice(-10);
  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route: 'q',
        message: `Your WinDaq verification code is ${otp}. Valid for 5 minutes. Do not share it with anyone.`,
        language: 'english',
        flash: 0,
        numbers: digits10
      }),
      signal: AbortSignal.timeout(8000)
    });
    const data = await response.json().catch(() => null);
    if (data && data.return === true) return { delivered: true };
    return { delivered: false, reason: 'SMS_PROVIDER_REJECTED' };
  } catch {
    return { delivered: false, reason: 'SMS_PROVIDER_UNREACHABLE' };
  }
}

/**
 * Issues an OTP for the phone number.
 * @returns {Promise<{ ok: true } | { ok: false, code: string, retryAfterMs?: number }>}
 */
async function issueOtp(phoneE164) {
  const existing = await prisma.otpChallenge.findUnique({ where: { phone: phoneE164 } });
  if (existing && Date.now() - existing.issuedAt.getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, code: 'OTP_COOLDOWN', retryAfterMs: RESEND_COOLDOWN_MS - (Date.now() - existing.issuedAt.getTime()) };
  }

  const devOtp = getDevFixedOtp();
  const otp = devOtp || crypto.randomInt(100000, 1000000).toString();

  if (!devOtp) {
    const delivery = await sendViaFast2Sms(phoneE164, otp);
    if (!delivery.delivered) return { ok: false, code: delivery.reason };
  }

  const data = {
    codeHash: hashOtp(phoneE164, otp),
    attempts: 0,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + OTP_TTL_MS)
  };
  await prisma.otpChallenge.upsert({ where: { phone: phoneE164 }, create: { phone: phoneE164, ...data }, update: data });
  return { ok: true };
}

/**
 * Verifies and consumes an OTP.
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>}
 */
async function verifyOtp(phoneE164, rawOtp) {
  const record = await prisma.otpChallenge.findUnique({ where: { phone: phoneE164 } });
  if (!record) return { ok: false, code: 'OTP_NOT_REQUESTED' };

  if (Date.now() > record.expiresAt.getTime()) {
    await prisma.otpChallenge.deleteMany({ where: { phone: phoneE164 } });
    return { ok: false, code: 'OTP_EXPIRED' };
  }

  // Atomically consume one attempt; fails when the limit is already reached.
  const claimed = await prisma.otpChallenge.updateMany({
    where: { phone: phoneE164, codeHash: record.codeHash, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } }
  });
  if (claimed.count !== 1) {
    await prisma.otpChallenge.deleteMany({ where: { phone: phoneE164, codeHash: record.codeHash } });
    return { ok: false, code: 'OTP_ATTEMPTS_EXCEEDED' };
  }

  const expected = Buffer.from(record.codeHash, 'hex');
  const actual = Buffer.from(hashOtp(phoneE164, String(rawOtp || '').trim()), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    return { ok: false, code: 'INVALID_OTP' };
  }

  // Single use: delete only this exact challenge (a concurrent correct guess cannot reuse it).
  const consumed = await prisma.otpChallenge.deleteMany({ where: { phone: phoneE164, codeHash: record.codeHash } });
  if (consumed.count !== 1) return { ok: false, code: 'OTP_NOT_REQUESTED' };
  return { ok: true };
}

module.exports = { issueOtp, verifyOtp };
