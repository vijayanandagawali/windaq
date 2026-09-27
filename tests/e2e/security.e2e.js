const { test, expect } = require('@playwright/test');
const { E2E } = require('./support/constants');

// These go through the public Next.js /api proxy, exactly as a browser on the live domain would.
test.describe('public API proxy security', () => {
  test('no fabricated balance for anonymous requests', async ({ request }) => {
    const res = await request.get('/api/ledger/balance');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.balance).toBeUndefined();
  });

  test('unsigned legacy tokens are rejected', async ({ request }) => {
    const forged = 'windaq_' + Buffer.from(JSON.stringify({ userId: 'x', role: 'SUPER_ADMIN' })).toString('base64');
    const res = await request.get('/api/auth/me', { headers: { Authorization: `Bearer ${forged}` } });
    expect(res.status()).toBe(401);
  });

  test('mock-token minting endpoint is gone', async ({ request }) => {
    const res = await request.get('/api/auth/mock-token?userId=attacker&role=SUPER_ADMIN');
    expect(res.status()).toBe(404);
  });

  test('sandbox identity headers are stripped by the proxy', async ({ request }) => {
    const res = await request.get('/api/ledger/balance', { headers: { 'x-user-id': E2E.finance.id, 'x-admin-user-id': 'mock-super-admin-id' } });
    expect(res.status()).toBe(401);
  });

  test('universal OTP codes do not log anyone in', async ({ request }) => {
    for (const otp of ['0000', '123456', '9999']) {
      const res = await request.post('/api/auth/login', { data: { phone: '9811100001', otp } });
      expect(res.status()).toBe(401);
    }
  });
});
