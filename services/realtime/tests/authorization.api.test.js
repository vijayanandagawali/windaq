const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let http;
let player;
let playerToken;

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
  player = await h.createUser({ balancePaise: 10000n });
  playerToken = h.tokenFor(player);
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

const adminRoutes = [
  ['GET', '/api/admin/history'],
  ['GET', '/api/admin/rounds/RND-1/timeline'],
  ['POST', '/api/admin/results/some-result/correct'],
  ['GET', '/api/admin/reconciliation'],
  ['POST', '/api/admin/reconciliation/run'],
  ['POST', '/api/admin/reconciliation/cases/REC-1/resolve'],
  ['GET', '/api/notifications/admin/logs'],
  ['POST', '/api/notifications/admin/retry/1'],
  ['GET', '/api/ledger'],
  ['POST', '/api/wager/settle'],
  ['POST', '/api/sports/admin/settle'],
  ['GET', '/api/payments/admin/withdrawals/pending'],
  ['GET', '/api/payments/admin/deposits/pending'],
  ['GET', '/api/compliance/admin/kyc'],
  ['POST', '/api/compliance/admin/kyc/KYC-1/review'],
  ['GET', '/api/admin/users'],
  ['GET', '/api/admin/risk/flags'],
  ['GET', '/api/admin/reconciliation/summary'],
  ['GET', '/api/admin/reconciliation/cases']
];

// Every GET the admin console loads must answer an admin (a 401 here signs the admin out in the browser).
const adminConsoleReads = [
  '/api/admin/dashboard', '/api/admin/users', '/api/admin/users?q=98', '/api/compliance/admin/kyc', '/api/admin/risk/flags',
  '/api/admin/reconciliation/summary', '/api/admin/reconciliation/cases?status=ALL', '/api/admin/adjustments', '/api/admin/audit',
  '/api/ledger?limit=100', '/api/payments/admin/deposits/pending', '/api/payments/admin/withdrawals/pending', '/api/payments/admin/bank-credits',
  '/api/admin/history'
];

test('every admin console read succeeds for a super admin', async () => {
  const admin = await h.createUser({ role: 'SUPER_ADMIN' });
  const token = h.tokenFor(admin);
  for (const route of adminConsoleReads) {
    const res = await http.request('GET', route, { token });
    assert.equal(res.status, 200, `GET ${route} returned ${res.status}: ${res.text.slice(0, 160)}`);
  }
  const users = await http.request('GET', '/api/admin/users', { token });
  const me = users.body.data.find((u) => u.id === admin.id);
  assert.equal(me.role, 'SUPER_ADMIN');
  assert.equal(typeof me.balance, 'number');
  const summary = await http.request('GET', '/api/admin/reconciliation/summary', { token });
  assert.equal(typeof summary.body.data.totalWallets, 'number');
});

test('admin routes reject anonymous requests', async () => {
  for (const [method, route] of adminRoutes) {
    const res = await http.request(method, route, { body: method === 'POST' ? {} : undefined });
    assert.equal(res.status, 401, `${method} ${route} returned ${res.status} without auth`);
  }
});

test('admin routes reject regular players, even with a forged role claim', async () => {
  for (const [method, route] of adminRoutes) {
    for (const token of [playerToken, h.tokenFor(player, { role: 'SUPER_ADMIN' })]) {
      const res = await http.request(method, route, { token, body: method === 'POST' ? {} : undefined });
      assert.equal(res.status, 403, `${method} ${route} returned ${res.status} for a player`);
    }
  }
});

test('sandbox identity headers are ignored outside explicit sandbox mode', async () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await http.request('GET', '/api/ledger/balance', { headers: { 'x-user-id': player.id } });
    assert.equal(res.status, 401);
    const admin = await http.request('GET', '/api/admin/dashboard', { headers: { 'x-admin-user-id': 'mock-super-admin-id' } });
    assert.equal(admin.status, 401);
  } finally {
    process.env.NODE_ENV = saved;
  }
});

test('finance staff can read the platform ledger', async () => {
  const finance = await h.createUser({ role: 'FINANCE' });
  const res = await http.request('GET', '/api/ledger', { token: h.tokenFor(finance) });
  assert.equal(res.status, 200);
});

test('removed deprecated wallet debit endpoint', async () => {
  const res = await http.request('POST', '/api/wallet/deduct', { token: playerToken, body: { userId: player.id, amount: 1 } });
  assert.equal(res.status, 404);
});
