const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const h = require('./helpers');

let http;

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

test('mock-token endpoint no longer exists', async () => {
  const res = await http.request('GET', '/api/auth/mock-token?userId=attacker&role=SUPER_ADMIN');
  assert.equal(res.status, 404);
});

test('universal OTP codes do not work without a requested OTP', async () => {
  for (const otp of ['1234', '0000', '123456', '9999']) {
    const res = await http.request('POST', '/api/auth/login', { body: { phone: '9876543210', otp } });
    assert.equal(res.status, 401, `otp ${otp} must be rejected`);
    assert.equal(res.body.code, 'OTP_NOT_REQUESTED');
  }
  assert.equal(await h.prisma.user.count({ where: { phone: '+919876543210' } }), 0, 'no account may be created');
});

test('send-otp never returns the code', async () => {
  const res = await http.request('POST', '/api/auth/send-otp', { body: { phone: '9876543211' } });
  assert.equal(res.status, 200);
  assert.ok(!JSON.stringify(res.body).includes('1234'));
  assert.equal(res.body.demoOtp, undefined);
});

test('verified login creates an account with zero cash balance', async () => {
  await http.request('POST', '/api/auth/send-otp', { body: { phone: '9876543212' } });
  const res = await http.request('POST', '/api/auth/login', { body: { phone: '9876543212', otp: '1234' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.wallet.balance, 0, 'no unbacked welcome credit');
  const wallet = await h.getWallet(res.body.user.id);
  assert.equal(wallet.balance, 0n);
  await h.assertLedgerMatchesWallet(assert, res.body.user.id);
});

test('register requires a verified OTP', async () => {
  const noOtp = await http.request('POST', '/api/auth/register', { body: { phone: '9876543213' } });
  assert.equal(noOtp.status, 400);
  const wrongOtp = await http.request('POST', '/api/auth/register', { body: { phone: '9876543213', otp: '1234' } });
  assert.equal(wrongOtp.status, 401);
  assert.equal(await h.prisma.user.count({ where: { phone: '+919876543213' } }), 0);
});

test('invalid phone numbers are rejected instead of padded', async () => {
  const res = await http.request('POST', '/api/auth/send-otp', { body: { phone: '12345' } });
  assert.equal(res.status, 400);
});

test('/me rejects tokens signed with the old fallback secret', async () => {
  const forged = jwt.sign({ userId: 'attacker', role: 'SUPER_ADMIN' }, 'super-secret-key-fallback');
  const res = await http.request('GET', '/api/auth/me', { token: forged });
  assert.equal(res.status, 401);
  assert.equal(await h.prisma.user.count({ where: { id: 'attacker' } }), 0);
});

test('/me rejects unsigned legacy windaq_ tokens', async () => {
  const unsigned = 'windaq_' + Buffer.from(JSON.stringify({ userId: 'x', role: 'SUPER_ADMIN' })).toString('base64');
  const res = await http.request('GET', '/api/auth/me', { token: unsigned });
  assert.equal(res.status, 401);
});

test('/me never creates users or trusts the role claim', async () => {
  const ghost = { id: 'usr_ghost_admin', phone: '+919999999999', role: 'SUPER_ADMIN' };
  const res = await http.request('GET', '/api/auth/me', { token: h.tokenFor(ghost) });
  assert.equal(res.status, 401);
  assert.equal(await h.prisma.user.count({ where: { id: ghost.id } }), 0);

  const user = await h.createUser({ role: 'USER' });
  const elevated = await http.request('GET', '/api/auth/me', { token: h.tokenFor(user, { role: 'SUPER_ADMIN' }) });
  assert.equal(elevated.status, 200);
  assert.equal(elevated.body.user.role, 'USER', 'role comes from the database');
});

test('JWT with alg=none is rejected', async () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 'x', role: 'SUPER_ADMIN' })).toString('base64url');
  const res = await http.request('GET', '/api/auth/me', { token: `${header}.${payload}.` });
  assert.equal(res.status, 401);
});
