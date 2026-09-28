const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const otp = require('../src/services/otpService');

let http;

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

async function login(phone) {
  await http.request('POST', '/api/auth/send-otp', { body: { phone } });
  const res = await http.request('POST', '/api/auth/login', { body: { phone, otp: '1234' } });
  assert.ok([200, 201].includes(res.status), JSON.stringify(res.body));
  return res.body;
}

test('OTP: production without an SMS provider issues nothing and no universal code works', async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, DEV_FIXED_OTP: process.env.DEV_FIXED_OTP };
  try {
    process.env.NODE_ENV = 'production';
    process.env.DEV_FIXED_OTP = '1234';
    const phone = '+919876500001';
    const issued = await otp.issueOtp(phone);
    assert.equal(issued.code, 'SMS_PROVIDER_NOT_CONFIGURED');
    assert.equal(await h.prisma.otpChallenge.count({ where: { phone } }), 0);
    for (const code of ['1234', '0000', '123456', '9999']) {
      assert.equal((await otp.verifyOtp(phone, code)).ok, false);
    }
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('OTP: stored hashed in the database, cooldown, single use', async () => {
  const phone = '+919876500002';
  assert.equal((await otp.issueOtp(phone)).ok, true);
  const row = await h.prisma.otpChallenge.findUnique({ where: { phone } });
  assert.match(row.codeHash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(row).includes('"1234"'));
  assert.equal((await otp.issueOtp(phone)).code, 'OTP_COOLDOWN');
  assert.equal((await otp.verifyOtp(phone, '1234')).ok, true);
  assert.equal((await otp.verifyOtp(phone, '1234')).code, 'OTP_NOT_REQUESTED', 'single use');
});

test('OTP: concurrent wrong guesses cannot exceed the attempt limit', async () => {
  const phone = '+919876500003';
  await otp.issueOtp(phone);
  const results = await Promise.all(Array.from({ length: 12 }, () => otp.verifyOtp(phone, '0000')));
  const invalid = results.filter((r) => r.code === 'INVALID_OTP').length;
  assert.ok(invalid <= 5, `only 5 guesses may be evaluated, got ${invalid}`);
  assert.equal((await otp.verifyOtp(phone, '1234')).ok, false, 'correct code must be dead after the limit');
});

test('login creates a server-side session; logout revokes it immediately', async () => {
  const body = await login('9876500010');
  assert.ok(body.token);
  assert.ok(body.session.expiresAt);
  const token = body.token;

  const sessions = await h.prisma.userSession.findMany({ where: { userId: body.user.id } });
  assert.equal(sessions.length, 1);

  assert.equal((await http.request('GET', '/api/auth/me', { token })).status, 200);
  assert.equal((await http.request('POST', '/api/auth/logout', { token })).status, 200);

  const after = await http.request('GET', '/api/auth/me', { token });
  assert.equal(after.status, 401);
  assert.equal(after.body.code, 'SESSION_REVOKED');
  assert.equal((await http.request('GET', '/api/ledger/balance', { token })).status, 401, 'revoked everywhere, not just /me');
});

test('logout-all signs out every device', async () => {
  const a = await login('9876500011');
  // Second device: a new OTP after the cooldown is simulated by clearing the challenge row.
  await h.prisma.otpChallenge.deleteMany({ where: { phone: '+919876500011' } });
  const b = await login('9876500011');
  assert.equal((await http.request('POST', '/api/auth/logout-all', { token: a.token })).body.revoked, 2);
  assert.equal((await http.request('GET', '/api/auth/me', { token: b.token })).status, 401);
});

test('expired and unknown sessions are rejected; legacy tokens without a session are rejected', async () => {
  const user = await h.createUser();
  await h.prisma.userSession.update({ where: { id: user.sid }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expired = await http.request('GET', '/api/auth/me', { token: h.tokenFor(user) });
  assert.equal(expired.status, 401);
  assert.equal(expired.body.code, 'SESSION_EXPIRED');

  const jwt = require('jsonwebtoken');
  const legacy = jwt.sign({ userId: user.id, role: 'USER' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
  assert.equal((await http.request('GET', '/api/auth/me', { token: legacy })).status, 401);
  const ticketAsSession = h.socketTicketFor({ ...user, sid: 'ses_does_not_exist' });
  assert.equal((await http.request('GET', '/api/auth/me', { token: ticketAsSession })).status, 401, 'socket tickets are not session tokens');
});

test('socket tickets are issued only to active sessions', async () => {
  const body = await login('9876500012');
  const res = await http.request('GET', '/api/auth/socket-ticket', { token: body.token });
  assert.equal(res.status, 200);
  assert.ok(res.body.ticket);
  assert.equal((await http.request('GET', '/api/auth/socket-ticket')).status, 401);
});

test('suspending an account revokes all its sessions', async () => {
  const risk = await h.createUser({ role: 'RISK' });
  const player = await h.createUser();
  await h.prisma.userRiskProfile.create({ data: { userId: player.id } });
  const flag = await h.prisma.riskFlag.create({ data: { userId: player.id, reasonCode: 'VELOCITY_ABUSE' } });

  const res = await http.request('POST', `/api/admin/risk/flags/${flag.id}/resolve`, {
    token: h.tokenFor(risk),
    body: { status: 'RESOLVED', suspendUser: true, notes: 'test suspension' }
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const me = await http.request('GET', '/api/auth/me', { token: h.tokenFor(player) });
  assert.equal(me.status, 401);
  assert.equal(me.body.code, 'SESSION_REVOKED');
});

test('ADMIN_PHONES promotes only an OTP-verified owner number, and never other players', async () => {
  process.env.ADMIN_PHONES = '9811100001, +91 98111 00002';
  try {
    const owner = await login('9811100001');
    assert.equal(owner.user.role, 'SUPER_ADMIN');
    const other = await login('9811100003');
    assert.equal(other.user.role, 'USER');

    // A wrong OTP for the owner number grants nothing.
    await http.request('POST', '/api/auth/send-otp', { body: { phone: '9811100002' } });
    const bad = await http.request('POST', '/api/auth/login', { body: { phone: '9811100002', otp: '0000' } });
    assert.notEqual(bad.status, 200);
    assert.equal(await h.prisma.user.count({ where: { phone: '+919811100002' } }), 0);
  } finally {
    delete process.env.ADMIN_PHONES;
  }
});
