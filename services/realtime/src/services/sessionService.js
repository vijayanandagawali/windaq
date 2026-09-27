/**
 * Server-side sessions.
 *
 * Every login creates a UserSession row; the session JWT only carries its id (sid) and is useless
 * once the row is revoked or expired. Identity and role are always re-read from the database, so a
 * token's claims can never grant more than the account currently has.
 *
 * Sockets never receive the session token: they get a 60-second "socket ticket" bound to the sid.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { getJwtSecret } = require('../config/security');

const prisma = new PrismaClient();

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 24 * 60 * 60);
const GUEST_SESSION_TTL_SECONDS = 12 * 60 * 60;
const SOCKET_TICKET_TTL_SECONDS = 60;
const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

class SessionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function newSessionId() {
  return `ses_${crypto.randomBytes(18).toString('base64url')}`;
}

/**
 * Creates a session and returns the signed session token.
 */
async function createSession(user, { isGuest = false, userAgent = null, ipAddress = null } = {}) {
  const ttl = isGuest ? GUEST_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  const sid = newSessionId();
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await prisma.userSession.create({
    data: {
      id: sid,
      userId: user.id,
      isGuest,
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
      ipAddress: ipAddress ? String(ipAddress).slice(0, 64) : null,
      expiresAt
    }
  });

  const token = jwt.sign(
    { typ: 'session', sid, userId: user.id, isGuest },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: ttl }
  );

  return { token, sid, expiresAt, maxAgeSeconds: ttl };
}

/**
 * Loads an active session + user for a verified sid. Throws SessionError when unusable.
 */
async function loadActiveSession(sid, expectedUserId) {
  const session = await prisma.userSession.findUnique({ where: { id: sid }, include: { user: true } });
  if (!session || session.userId !== expectedUserId) {
    throw new SessionError('SESSION_INVALID', 'Session not found. Please sign in again.');
  }
  if (session.revokedAt) {
    throw new SessionError('SESSION_REVOKED', 'You have been signed out. Please sign in again.');
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new SessionError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
  }

  // Throttled activity tracking (best effort, never blocks the request).
  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
    prisma.userSession.update({ where: { id: sid }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return session;
}

function verifyJwt(token, expectedType) {
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new SessionError('SESSION_EXPIRED', 'Session expired. Please sign in again.');
    throw new SessionError('INVALID_TOKEN', 'Invalid authorization token.');
  }
  if (payload.typ !== expectedType || !payload.sid || !payload.userId) {
    throw new SessionError('INVALID_TOKEN', 'Invalid authorization token.');
  }
  return payload;
}

/**
 * Verifies a session token and returns { session, user, identity }.
 * identity is the request principal: { userId, role, phone, isGuest, sid } with the role from the DB.
 */
async function authenticateSessionToken(token) {
  const payload = verifyJwt(token, 'session');
  const session = await loadActiveSession(payload.sid, payload.userId);
  const { user } = session;
  return {
    session,
    user,
    identity: { userId: user.id, id: user.id, role: user.role, phone: user.phone, isGuest: session.isGuest, sid: session.id }
  };
}

async function issueSocketTicket(identity) {
  return jwt.sign(
    { typ: 'socket', sid: identity.sid, userId: identity.userId },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: SOCKET_TICKET_TTL_SECONDS }
  );
}

/**
 * Verifies a socket ticket against a still-active session.
 */
async function authenticateSocketTicket(ticket) {
  const payload = verifyJwt(ticket, 'socket');
  const session = await loadActiveSession(payload.sid, payload.userId);
  const { user } = session;
  return { userId: user.id, id: user.id, role: user.role, phone: user.phone, isGuest: session.isGuest, sid: session.id };
}

async function revokeSession(sid, reason = 'LOGOUT') {
  await prisma.userSession.updateMany({
    where: { id: sid, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason }
  });
}

async function revokeAllSessionsForUser(userId, reason = 'LOGOUT_ALL') {
  const result = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason }
  });
  return result.count;
}

module.exports = {
  SessionError,
  SESSION_TTL_SECONDS,
  createSession,
  authenticateSessionToken,
  issueSocketTicket,
  authenticateSocketTicket,
  revokeSession,
  revokeAllSessionsForUser
};
