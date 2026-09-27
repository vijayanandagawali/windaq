/**
 * Server-side OTP issuance & verification.
 *
 * - OTPs are generated with crypto.randomInt and stored only as SHA-256 hashes.
 * - OTP values are never logged or returned in API responses.
 * - Max 5 verification attempts per code, 5-minute expiry, 30-second resend cooldown.
 * - A fixed development OTP is honoured ONLY when NODE_ENV !== 'production' and
 *   DEV_FIXED_OTP is explicitly configured (NODE_ENV=test defaults it to 1234 for test suites).
 *
 * NOTE: the store is in-process memory, so the realtime service must run as a single
 * instance until this is moved to a shared store (Redis/DB).
 */

const crypto = require('crypto');

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

const otpStore = new Map(); // phone -> { hash, expiresAt, attempts, issuedAt }

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
  const existing = otpStore.get(phoneE164);
  if (existing && Date.now() - existing.issuedAt < RESEND_COOLDOWN_MS) {
    return { ok: false, code: 'OTP_COOLDOWN', retryAfterMs: RESEND_COOLDOWN_MS - (Date.now() - existing.issuedAt) };
  }

  const devOtp = getDevFixedOtp();
  const otp = devOtp || crypto.randomInt(100000, 1000000).toString();

  if (!devOtp) {
    const delivery = await sendViaFast2Sms(phoneE164, otp);
    if (!delivery.delivered) return { ok: false, code: delivery.reason };
  }

  otpStore.set(phoneE164, {
    hash: hashOtp(phoneE164, otp),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    issuedAt: Date.now()
  });
  return { ok: true };
}

/**
 * Verifies and consumes an OTP.
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
function verifyOtp(phoneE164, rawOtp) {
  const record = otpStore.get(phoneE164);
  if (!record) return { ok: false, code: 'OTP_NOT_REQUESTED' };

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phoneE164);
    return { ok: false, code: 'OTP_EXPIRED' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phoneE164);
    return { ok: false, code: 'OTP_ATTEMPTS_EXCEEDED' };
  }
  record.attempts += 1;

  const expected = Buffer.from(record.hash, 'hex');
  const actual = Buffer.from(hashOtp(phoneE164, String(rawOtp || '').trim()), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    return { ok: false, code: 'INVALID_OTP' };
  }

  otpStore.delete(phoneE164);
  return { ok: true };
}

module.exports = { issueOtp, verifyOtp, _otpStore: otpStore };
