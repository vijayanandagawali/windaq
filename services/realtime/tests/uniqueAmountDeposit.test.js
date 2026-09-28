const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { expireStaleDeposits } = require('../src/services/manualPaymentService');

const TOKEN = process.env.BANK_SMS_TOKEN;
let http;
let seq = 0;

const nextUtr = () => `5268${String(Date.now()).slice(-6)}${String(seq++).padStart(2, '0')}`;
const rupees = (paise) => (Number(paise) / 100).toFixed(2);
const sbiSms = (amountText, utr) =>
  `Dear UPI user A/C X1234 credited by Rs${amountText} on date 28Sep26 trf from RAHUL K Refno ${utr}. If not u? call 1800111109. -SBI`;
const sendSms = (text, receivedStamp = Date.now()) =>
  http.request('POST', '/api/payments/bank-sms', { headers: { 'x-windaq-sms-token': TOKEN }, body: { from: 'AD-SBIUPI', text, receivedStamp } });
const start = (user, amount) => http.request('POST', '/api/ledger/deposit/start', { token: h.tokenFor(user), body: { amount } });
const attachUtr = (user, id, utr) => http.request('POST', `/api/ledger/deposit/${id}/utr`, { token: h.tokenFor(user), body: { utr } });
const toPaise = (rupeeNumber) => BigInt(Math.round(rupeeNumber * 100));

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

test('a unique amount is reserved and the bank SMS for exactly that amount credits it with no UTR typed', async () => {
  const user = await h.createUser();
  const res = await start(user, 200);
  assert.equal(res.status, 201);
  const d = res.body.data;
  assert.equal(d.status, 'AWAITING_PAYMENT');
  assert.equal(d.requestedAmount, 200);
  assert.ok(d.amount > 200 && d.amount < 201, `amount ${d.amount} carries 1–99 paise`);
  assert.ok(new Date(d.expiresAt).getTime() > Date.now());
  assert.equal((await h.getWallet(user.id)).pendingDeposit, toPaise(d.amount));

  const again = await start(user, 200);
  assert.equal(again.status, 200, 'asking again returns the open deposit');
  assert.equal(again.body.data.intentId, d.intentId);

  const utr = nextUtr();
  const sms = await sendSms(sbiSms(d.amount.toFixed(2), utr));
  assert.equal(sms.body.matched, true);

  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, toPaise(d.amount), 'the exact amount paid is credited');
  assert.equal(wallet.pendingDeposit, 0n);
  const intent = await h.prisma.paymentIntent.findUnique({ where: { id: d.intentId } });
  assert.equal(intent.status, 'SUCCESS');
  assert.equal(intent.providerReference, `UTR:${utr}`);
  assert.equal(intent.metadata.matchedBy, 'AMOUNT');
  await h.assertLedgerMatchesWallet(assert, user.id);

  // Replaying the same SMS credits nothing more.
  await sendSms(sbiSms(d.amount.toFixed(2), utr));
  assert.equal((await h.getWallet(user.id)).balance, toPaise(d.amount));
});

test('players asking for the same rupee amount at once each get a different exact amount', async () => {
  const users = await Promise.all(Array.from({ length: 15 }, () => h.createUser()));
  const results = await Promise.all(users.map((u) => start(u, 300)));
  results.forEach((r) => assert.equal(r.status, 201));
  const amounts = results.map((r) => r.body.data.amount);
  assert.equal(new Set(amounts).size, amounts.length, `duplicate amounts: ${amounts.join(', ')}`);
});

test('near-miss amounts, whole rupees and credits from before the deposit are never matched', async () => {
  const user = await h.createUser();
  const d = (await start(user, 400)).body.data;
  const paise = toPaise(d.amount);

  await sendSms(sbiSms('400.00', nextUtr()));
  await sendSms(sbiSms(rupees(paise === 40099n ? paise - 1n : paise + 1n), nextUtr()));
  await sendSms(sbiSms(d.amount.toFixed(2), nextUtr()), Date.now() - 60 * 60 * 1000); // bank time an hour earlier
  assert.equal((await h.getWallet(user.id)).balance, 0n);
  const intent = await h.prisma.paymentIntent.findUnique({ where: { id: d.intentId } });
  assert.equal(intent.status, 'AWAITING_PAYMENT');
});

test('backup UTR: attached before the SMS, the SMS with that UTR credits it', async () => {
  const user = await h.createUser();
  const d = (await start(user, 500)).body.data;
  const utr = nextUtr();
  const attached = await attachUtr(user, d.intentId, utr);
  assert.equal(attached.status, 200);
  assert.equal(attached.body.data.status, 'PENDING_REVIEW');

  const sms = await sendSms(sbiSms(d.amount.toFixed(2), utr));
  assert.equal(sms.body.matched, true);
  assert.equal((await h.getWallet(user.id)).balance, toPaise(d.amount));
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('an expired deposit frees its amount; a late payment is credited once the player adds the UTR', async () => {
  const user = await h.createUser();
  const d = (await start(user, 600)).body.data;
  await h.prisma.paymentIntent.update({ where: { id: d.intentId }, data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) } });
  assert.equal(await expireStaleDeposits(h.prisma), 1);
  assert.equal((await h.getWallet(user.id)).pendingDeposit, 0n);

  const utr = nextUtr();
  const sms = await sendSms(sbiSms(d.amount.toFixed(2), utr));
  assert.equal(sms.body.matched, false, 'expired deposits are not matched by amount');

  const attached = await attachUtr(user, d.intentId, utr);
  assert.equal(attached.body.data.status, 'SUCCESS');
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, toPaise(d.amount));
  assert.equal(wallet.pendingDeposit, 0n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('limits: whole rupees only, three open deposits per player, no guests, own deposits only', async () => {
  const user = await h.createUser();
  assert.equal((await start(user, 250.5)).status, 400);
  for (const amt of [700, 800, 900]) assert.equal((await start(user, amt)).status, 201);
  assert.equal((await start(user, 1000)).status, 429);

  const guest = await h.createUser({ isGuest: true });
  assert.equal((await start(guest, 700)).status, 403);

  const other = await h.createUser();
  const mine = (await start(other, 1100)).body.data;
  assert.equal((await attachUtr(user, mine.intentId, nextUtr())).status, 404);
});
