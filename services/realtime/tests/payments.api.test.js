const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let http;
let finance;
let financeToken;

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
  finance = await h.createUser({ role: 'FINANCE' });
  financeToken = h.tokenFor(finance);
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

test('deposit request never credits the wallet directly', async () => {
  const user = await h.createUser({ balancePaise: 0n });
  const res = await http.request('POST', '/api/ledger/deposit/instant', {
    token: h.tokenFor(user),
    body: { amount: 1000000, utr: '412345678901' }
  });
  assert.equal(res.status, 400, 'above max deposit');

  const ok = await http.request('POST', '/api/ledger/deposit/instant', {
    token: h.tokenFor(user),
    body: { amount: 500, utr: '412345678901' }
  });
  assert.equal(ok.status, 202);
  assert.equal(ok.body.status, 'PENDING_REVIEW');
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 0n, 'balance unchanged until verification');
  assert.equal(wallet.pendingDeposit, 50000n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('deposit requires a UTR and a valid amount', async () => {
  const user = await h.createUser();
  const token = h.tokenFor(user);
  assert.equal((await http.request('POST', '/api/ledger/deposit/instant', { token, body: { amount: 500 } })).status, 400);
  assert.equal((await http.request('POST', '/api/ledger/deposit/instant', { token, body: { amount: -500, utr: '412345678999' } })).status, 400);
  assert.equal((await http.request('POST', '/api/ledger/deposit/instant', { token, body: { amount: '1e9', utr: '412345678999' } })).status, 400);
  assert.equal((await http.request('POST', '/api/ledger/deposit/instant', { token, body: { amount: 50, utr: '412345678999' } })).status, 400);
});

test('a UTR can only be claimed once across users', async () => {
  const a = await h.createUser();
  const b = await h.createUser();
  const body = { amount: 300, utr: '555566667777' };
  assert.equal((await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(a), body })).status, 202);
  const dupSame = await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(a), body });
  assert.equal(dupSame.status, 200);
  assert.equal(dupSame.body.data.isDuplicate, true);
  assert.equal((await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(b), body })).status, 409);
});

test('guest accounts cannot deposit or withdraw', async () => {
  const guest = await h.createUser({ isGuest: true, balancePaise: 5000000n });
  const token = h.tokenFor(guest);
  const dep = await http.request('POST', '/api/ledger/deposit/instant', { token, body: { amount: 500, utr: '999988887777' } });
  assert.equal(dep.status, 403);
  const wd = await http.request('POST', '/api/ledger/withdraw/instant', { token, body: { amount: 500, upiId: 'guest@okaxis' } });
  assert.equal(wd.status, 403);
  // Even if the isGuest claim is stripped, the sbx_guest_ id is still blocked.
  const stripped = await http.request('POST', '/api/ledger/withdraw/instant', { token: h.tokenFor(guest, { isGuest: false }), body: { amount: 500, upiId: 'guest@okaxis' } });
  assert.equal(stripped.status, 403);
  assert.equal((await h.getWallet(guest.id)).lockedBalance, 0n);
});

test('finance approval credits exactly once, even with concurrent approvals', async () => {
  const user = await h.createUser();
  const res = await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(user), body: { amount: 750, utr: '123412341234' } });
  const intentId = res.body.data.intentId;

  const results = await Promise.all(Array.from({ length: 5 }, () =>
    http.request('POST', `/api/payments/admin/deposits/${intentId}/approve`, { token: financeToken, body: { note: 'seen on statement' } })
  ));
  assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results.map((r) => r.status)));
  assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409 || r.status === 500));

  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 75000n);
  assert.equal(wallet.pendingDeposit, 0n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('players cannot approve their own deposits', async () => {
  const user = await h.createUser();
  const res = await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(user), body: { amount: 400, utr: '777788889999' } });
  const approve = await http.request('POST', `/api/payments/admin/deposits/${res.body.data.intentId}/approve`, { token: h.tokenFor(user) });
  assert.equal(approve.status, 403);
  const forgedRole = await http.request('POST', `/api/payments/admin/deposits/${res.body.data.intentId}/approve`, { token: h.tokenFor(user, { role: 'FINANCE' }) });
  assert.equal(forgedRole.status, 403, 'role is read from the database, not the token');
  assert.equal((await h.getWallet(user.id)).balance, 0n);
});

test('rejected deposit releases the pending amount without crediting', async () => {
  const user = await h.createUser();
  const res = await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(user), body: { amount: 400, utr: '101020203030' } });
  const noNote = await http.request('POST', `/api/payments/admin/deposits/${res.body.data.intentId}/reject`, { token: financeToken, body: {} });
  assert.equal(noNote.status, 400);
  const rej = await http.request('POST', `/api/payments/admin/deposits/${res.body.data.intentId}/reject`, { token: financeToken, body: { note: 'UTR not found' } });
  assert.equal(rej.status, 200);
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 0n);
  assert.equal(wallet.pendingDeposit, 0n);
});

test('withdrawal locks funds and waits for review; nothing is paid automatically', async () => {
  const user = await h.createUser({ balancePaise: 100000n }); // ₹1000
  const token = h.tokenFor(user);
  const res = await http.request('POST', '/api/ledger/withdraw/instant', { token, body: { amount: 600, upiId: 'player@okhdfcbank', idempotencyKey: 'wd-key-0001' } });
  assert.equal(res.status, 202);
  assert.equal(res.body.status, 'PENDING_REVIEW');

  let wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 100000n);
  assert.equal(wallet.lockedBalance, 60000n);
  await h.assertLedgerMatchesWallet(assert, user.id);

  // Idempotent resubmission does not lock twice
  const again = await http.request('POST', '/api/ledger/withdraw/instant', { token, body: { amount: 600, upiId: 'player@okhdfcbank', idempotencyKey: 'wd-key-0001' } });
  assert.equal(again.body.data.isDuplicate, true);
  assert.equal((await h.getWallet(user.id)).lockedBalance, 60000n);

  // Cannot withdraw more than the remaining available balance
  const over = await http.request('POST', '/api/ledger/withdraw/instant', { token, body: { amount: 500, upiId: 'player@okhdfcbank' } });
  assert.equal(over.status, 400);

  const intent = await h.prisma.paymentIntent.findFirst({ where: { userId: user.id, type: 'WITHDRAWAL' } });
  const noRef = await http.request('POST', `/api/payments/admin/withdrawals/${intent.id}/approve`, { token: financeToken, body: {} });
  assert.equal(noRef.status, 400, 'payout reference required');
  const paid = await http.request('POST', `/api/payments/admin/withdrawals/${intent.id}/approve`, { token: financeToken, body: { note: 'IMPS 998877' } });
  assert.equal(paid.status, 200);

  wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 40000n);
  assert.equal(wallet.lockedBalance, 0n);
  assert.equal(wallet.totalWithdrawn, 60000n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('concurrent approve and reject: exactly one wins and funds stay consistent', async () => {
  const user = await h.createUser({ balancePaise: 50000n });
  const res = await http.request('POST', '/api/ledger/withdraw/instant', { token: h.tokenFor(user), body: { amount: 300, upiId: 'player2@okaxis' } });
  const id = res.body.data.intentId;
  const [a, r] = await Promise.all([
    http.request('POST', `/api/payments/admin/withdrawals/${id}/approve`, { token: financeToken, body: { note: 'paid' } }),
    http.request('POST', `/api/payments/admin/withdrawals/${id}/reject`, { token: financeToken, body: { note: 'rejected' } })
  ]);
  assert.equal([a, r].filter((x) => x.status === 200).length, 1, `${a.status}/${r.status}`);
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.lockedBalance, 0n);
  assert.ok(wallet.balance === 20000n || wallet.balance === 50000n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('concurrent withdrawals cannot overdraw the wallet', async () => {
  const user = await h.createUser({ balancePaise: 100000n });
  const token = h.tokenFor(user);
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    http.request('POST', '/api/ledger/withdraw/instant', { token, body: { amount: 400, upiId: 'race@okaxis', idempotencyKey: `race-key-${i}-xyz` } })
  ));
  const accepted = results.filter((r) => r.status === 202).length;
  assert.equal(accepted, 2, `only 2 x ₹400 fit in ₹1000, got ${accepted}`);
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.lockedBalance, 80000n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('mock provider initiation and weak webhooks are closed', async () => {
  const user = await h.createUser();
  const dep = await http.request('POST', '/api/payments/deposit', { token: h.tokenFor(user), body: { amount: 500, provider: 'MOCK_UPI' } });
  assert.equal(dep.status, 410);
  const hook = await http.request('POST', '/api/payments/webhook/mock_upi', {
    body: { providerReference: 'x', status: 'SUCCESS' },
    headers: { 'x-provider-signature': 'deadbeef' }
  });
  assert.equal(hook.status, 400);
});

test('payment intent status is only visible to its owner', async () => {
  const a = await h.createUser();
  const b = await h.createUser();
  const res = await http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(a), body: { amount: 200, utr: '246824682468' } });
  const id = res.body.data.intentId;
  assert.equal((await http.request('GET', `/api/payments/intent/${id}`)).status, 401);
  assert.equal((await http.request('GET', `/api/payments/intent/${id}`, { token: h.tokenFor(b) })).status, 404);
  assert.equal((await http.request('GET', `/api/payments/intent/${id}`, { token: h.tokenFor(a) })).status, 200);
});
