const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requireAuth } = require('../middleware/auth');
const { ensureUserAndWallet } = require('../services/walletService');
const sessionService = require('../services/sessionService');
const { issueOtp, verifyOtp } = require('../services/otpService');


const GUEST_TEST_CREDITS_PAISE = 5000000n; // ₹50,000 play-money for explicit test/guest mode

function isGuestModeEnabled() {
  if (process.env.NODE_ENV !== 'production') return process.env.ENABLE_GUEST_MODE !== 'false';
  return process.env.ENABLE_GUEST_MODE === 'true';
}

/**
 * Normalizes an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Returns null unless the input is exactly 10 digits, optionally prefixed with 91/0.
 */
function normalizePhone(rawPhone) {
  if (!rawPhone) return null;
  let digits = rawPhone.toString().replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/**
 * Creates a server-side session. The returned token is handed to the Next.js proxy, which stores it
 * in an httpOnly cookie; browsers never read it.
 */
function startSession(req, user, isGuest) {
  return sessionService.createSession(user, {
    isGuest,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip
  });
}

function sessionPayload(session) {
  return { token: session.token, session: { expiresAt: session.expiresAt.toISOString(), maxAgeSeconds: session.maxAgeSeconds } };
}

function otpErrorResponse(res, code) {
  const messages = {
    OTP_NOT_REQUESTED: 'Please request a verification code first.',
    OTP_EXPIRED: 'Your verification code has expired. Please request a new one.',
    OTP_ATTEMPTS_EXCEEDED: 'Too many incorrect attempts. Please request a new code.',
    INVALID_OTP: 'Invalid verification code. Please check and try again.'
  };
  return res.status(401).json({ success: false, code, message: messages[code] || 'Verification failed.' });
}

function invalidPhone(res) {
  return res.status(400).json({
    success: false,
    code: 'INVALID_PHONE',
    message: 'Please provide a valid 10-digit Indian mobile number.'
  });
}

function publicUser(user, isGuest) {
  return { id: user.id, phone: user.phone, role: user.role, isGuest, createdAt: user.createdAt };
}

/**
 * POST /api/auth/send-otp
 * Issues an OTP via the SMS provider. The code is never returned or logged.
 */
router.post('/send-otp', async (req, res) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) return invalidPhone(res);

    const result = await issueOtp(phone);
    if (!result.ok) {
      if (result.code === 'OTP_COOLDOWN') {
        return res.status(429).json({
          success: false,
          code: result.code,
          message: `Please wait ${Math.ceil(result.retryAfterMs / 1000)} seconds before requesting another code.`
        });
      }
      console.error('[Auth /send-otp] OTP delivery failed:', result.code);
      return res.status(503).json({
        success: false,
        code: result.code,
        message: 'We could not send the verification code right now. Please try again shortly.'
      });
    }

    return res.json({ success: true, message: `Verification code sent to ${phone.slice(0, 5)}XXXXX${phone.slice(-2)}` });
  } catch (error) {
    console.error('[Auth send-otp Error]:', error.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to send OTP. Please try again.' });
  }
});

/**
 * Shared login/registration handler: verifies the OTP, then finds or creates the user.
 * New accounts start with a zero cash balance — no unbacked credit is ever minted here.
 */
async function authenticateWithOtp(req, res, { mustBeNew }) {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return invalidPhone(res);

  const otp = req.body?.otp ? req.body.otp.toString().trim() : '';
  if (!otp) {
    return res.status(400).json({ success: false, code: 'OTP_REQUIRED', message: 'Please enter the verification code (OTP).' });
  }

  let user = await prisma.user.findUnique({ where: { phone } });
  if (mustBeNew && user) {
    return res.status(409).json({
      success: false,
      code: 'USER_EXISTS',
      message: 'This mobile number is already registered. Please log in instead.'
    });
  }

  const verification = await verifyOtp(phone, otp);
  if (!verification.ok) return otpErrorResponse(res, verification.code);

  if (user) {
    const risk = await prisma.userRiskProfile.findUnique({ where: { userId: user.id } }).catch(() => null);
    if (risk && risk.isSuspended) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_RESTRICTED', message: 'This account is restricted. Please contact support.' });
    }
  }

  const isNewUser = !user;
  if (isNewUser) {
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const result = await ensureUserAndWallet(prisma, userId, { phone, role: 'USER', initialPaise: 0n });
    user = result.user;

    await prisma.kycProfile.upsert({
      where: { userId },
      create: { userId, status: 'PENDING', jurisdiction: 'IN-MH' },
      update: {}
    }).catch(() => {});
    await prisma.userRiskProfile.upsert({
      where: { userId },
      create: { userId, riskScore: 0, isSuspended: false },
      update: {}
    }).catch(() => {});
  }

  const wallet = await prisma.wallet.findFirst({ where: { userId: user.id, currency: 'INR' } });
  const session = await startSession(req, user, false);

  return res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser ? 'Welcome! Your account has been created.' : 'Login successful.',
    ...sessionPayload(session),
    user: publicUser(user, false),
    wallet: { balance: wallet ? Number(wallet.balance) / 100 : 0, currency: 'INR' }
  });
}

/**
 * POST /api/auth/register — OTP-verified account creation.
 */
router.post('/register', async (req, res) => {
  try {
    return await authenticateWithOtp(req, res, { mustBeNew: true });
  } catch (error) {
    console.error('[Auth Register Error]:', error.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Registration failed due to a server error. Please try again.' });
  }
});

/**
 * POST /api/auth/login — OTP-verified login (creates the account on first verified login).
 */
router.post('/login', async (req, res) => {
  try {
    return await authenticateWithOtp(req, res, { mustBeNew: false });
  } catch (error) {
    console.error('[Auth Login Error]:', error.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Login failed due to a server error. Please try again.' });
  }
});

/**
 * POST /api/auth/guest
 * Explicit TEST MODE guest account with play-money credits.
 * Guest wallets can never deposit or withdraw (enforced in the ledger routes).
 * Disabled in production unless ENABLE_GUEST_MODE=true.
 */
router.post('/guest', async (req, res) => {
  if (!isGuestModeEnabled()) {
    return res.status(403).json({ success: false, code: 'GUEST_MODE_DISABLED', message: 'Guest test mode is not available.' });
  }
  try {
    const guestSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const guestId = `sbx_guest_${guestSuffix}`;
    const guestPhone = `+90000${crypto.randomInt(10000000, 99999999)}`;

    const { user, wallet } = await ensureUserAndWallet(prisma, guestId, {
      phone: guestPhone,
      role: 'USER',
      initialPaise: GUEST_TEST_CREDITS_PAISE
    });

    const session = await startSession(req, user, true);

    return res.json({
      success: true,
      message: 'Guest test account initialized with ₹50,000 play-money balance (not withdrawable).',
      ...sessionPayload(session),
      user: publicUser(user, true),
      wallet: { balance: Number(wallet.balance) / 100, currency: 'INR' }
    });
  } catch (error) {
    console.error('[Auth Guest Error]:', error.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to provision guest test account.' });
  }
});

/**
 * GET /api/auth/me
 * Returns the authenticated user. Never creates users or trusts role claims from the token:
 * the role always comes from the database.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Account not found. Please sign in again.' });
    }

    // Wallet self-heal is allowed (zero balance only), user creation is not.
    const { wallet } = await ensureUserAndWallet(prisma, user.id, { initialPaise: 0n });
    const kyc = await prisma.kycProfile.findUnique({ where: { userId } }).catch(() => null);
    const risk = await prisma.userRiskProfile.findUnique({ where: { userId } }).catch(() => null);

    return res.json({
      success: true,
      user: {
        ...publicUser(user, Boolean(req.user.isGuest)),
        kycStatus: kyc ? kyc.status : 'PENDING',
        isSuspended: Boolean(risk?.isSuspended)
      },
      wallet: { balance: Number(wallet.balance) / 100, currency: 'INR' }
    });
  } catch (error) {
    console.error('[Auth /me Error]:', error.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Failed to retrieve user session.' });
  }
});

/**
 * GET /api/auth/socket-ticket
 * Short-lived (60 s) ticket for opening an authenticated socket connection. The session token
 * itself is never exposed to page scripts.
 */
router.get('/socket-ticket', requireAuth, async (req, res) => {
  if (!req.user.sid) {
    return res.status(401).json({ success: false, code: 'SESSION_REQUIRED', message: 'A signed-in session is required.' });
  }
  const ticket = await sessionService.issueSocketTicket(req.user);
  res.set('Cache-Control', 'no-store');
  return res.json({ success: true, ticket, expiresInSeconds: 60 });
});

/**
 * POST /api/auth/logout — revokes the current session (server-side, survives restarts).
 */
router.post('/logout', requireAuth, async (req, res) => {
  if (req.user.sid) await sessionService.revokeSession(req.user.sid, 'LOGOUT');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * POST /api/auth/logout-all — revokes every session of the current user (all devices).
 */
router.post('/logout-all', requireAuth, async (req, res) => {
  const count = await sessionService.revokeAllSessionsForUser(req.user.userId, 'LOGOUT_ALL');
  return res.json({ success: true, message: `Signed out of ${count} session(s).`, revoked: count });
});

module.exports = router;
module.exports.normalizePhone = normalizePhone;
