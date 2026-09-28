const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { parseBankSms } = require('../src/services/bankSmsService');

const TOKEN = process.env.BANK_SMS_TOKEN;
let http;
let seq = 0;

const nextUtr = () => `5267${String(Date.now()).slice(-6)}${String(seq++).padStart(2, '0')}`;
const sbiSms = (amount, utr, name = 'RAHUL K') =>
  `Dear UPI user A/C X1234 credited by Rs${amount} on date 28Sep26 trf from ${name} Refno ${utr}. If not u? call 1800111109. -SBI`;

const sendSms = (text, { from = 'AD-SBIUPI', token = TOKEN } = {}) =>
  http.request('POST', '/api/payments/bank-sms', { headers: token ? { 'x-windaq-sms-token': token } : {}, body: { from, text, receivedStamp: Date.now() } });
const submitUtr = (user, amount, utr) =>
  http.request('POST', '/api/ledger/deposit/instant', { token: h.tokenFor(user), body: { amount, utr } });

test.before(async () => {
  await h.resetDb();
  http = await h.startHttp();
});

test.after(async () => {
  await http.close();
  await h.prisma.$disconnect();
});

test('parser reads SBI UPI credit SMS formats and ignores everything else', () => {
  assert.deepEqual(parseBankSms(sbiSms('500.00', '526712345678')), { utr: '526712345678', amountPaise: 50000n, payerName: 'RAHUL K' });
  const other = parseBankSms('Your A/c XX1234 is credited by Rs.1,250.50 on 28-09-26 (UPI Ref No 526700000001) -SBI');
  assert.equal(other.utr, '526700000001');
  assert.equal(other.amountPaise, 125050n);
  assert.equal(parseBankSms('Dear UPI user A/C X1234 debited by Rs500.00 on 28Sep26 trf to SHOP Refno 526712345678 -SBI'), null, 'debits are ignored');
  assert.equal(parseBankSms('Your A/C XXXXX1234 Credited INR 500.00 on 28/09/26 -Deposit by transfer from X. Avl Bal INR 900 -SBI'), null, 'no UPI reference, no credit');
  assert.equal(parseBankSms('Get Rs500 cashback! Refno 526712345678'), null, 'promotions are ignored');
});

test('the forwarder endpoint rejects missing or wrong tokens and foreign senders', async () => {
  assert.equal((await sendSms(sbiSms('500.00', nextUtr()), { token: null })).status, 401);
  assert.equal((await sendSms(sbiSms('500.00', nextUtr()), { token: 'x'.repeat(TOKEN.length) })).status, 401);
  const spoof = await sendSms(sbiSms('500.00', nextUtr()), { from: 'VM-FAKEBK' });
  assert.equal(spoof.status, 200);
  assert.equal(spoof.body.accepted, false);
  assert.equal(await h.prisma.bankCredit.count(), 0);
});

test('bank SMS first, then the player submits the UTR: credited instantly', async () => {
  const user = await h.createUser({ balancePaise: 0n });
  const utr = nextUtr();
  const sms = await sendSms(sbiSms('750.00', utr));
  assert.equal(sms.body.accepted, true);
  assert.equal(sms.body.matched, false, 'no deposit request yet');

  const res = await submitUtr(user, 750, utr);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'SUCCESS');
  const wallet = await h.getWallet(user.id);
  assert.equal(wallet.balance, 75000n);
  assert.equal(wallet.pendingDeposit, 0n);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('player submits the UTR first, then the bank SMS arrives: credited automatically', async () => {
  const user = await h.createUser({ balancePaise: 0n });
  const utr = nextUtr();
  const res = await submitUtr(user, 1200, utr);
  assert.equal(res.status, 202);
  assert.equal((await h.getWallet(user.id)).balance, 0n, 'nothing is credited on the player\'s word');

  const sms = await sendSms(sbiSms('1,200.00', utr));
  assert.equal(sms.body.matched, true);
  assert.equal((await h.getWallet(user.id)).balance, 120000n);
  const intent = await h.prisma.paymentIntent.findUnique({ where: { providerReference: `UTR:${utr}` } });
  assert.equal(intent.status, 'SUCCESS');
  assert.equal(intent.metadata.reviewedBy, 'AUTO_BANK_SMS');
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('a fake UTR or a wrong amount is never credited', async () => {
  const user = await h.createUser({ balancePaise: 0n });
  const fake = await submitUtr(user, 5000, nextUtr());
  assert.equal(fake.body.status, 'PENDING_REVIEW');

  const utr = nextUtr();
  await submitUtr(user, 5000, utr);          // claims ₹5,000
  const sms = await sendSms(sbiSms('50.00', utr)); // actually paid ₹50
  assert.equal(sms.body.matched, false);
  const credit = await h.prisma.bankCredit.findUnique({ where: { utr } });
  assert.equal(credit.status, 'AMOUNT_MISMATCH', 'left for finance to resolve');
  assert.equal((await h.getWallet(user.id)).balance, 0n);
});

test('a replayed SMS and a racing UTR submission credit exactly once', async () => {
  const user = await h.createUser({ balancePaise: 0n });
  const utr = nextUtr();
  const text = sbiSms('300.00', utr);
  await Promise.all([sendSms(text), sendSms(text), submitUtr(user, 300, utr), submitUtr(user, 300, utr), sendSms(text)]);
  await sendSms(text);
  assert.equal((await h.getWallet(user.id)).balance, 30000n);
  assert.equal(await h.prisma.bankCredit.count({ where: { utr } }), 1);
  await h.assertLedgerMatchesWallet(assert, user.id);
});

test('another player cannot claim a UTR that is already taken', async () => {
  const payer = await h.createUser({ balancePaise: 0n });
  const thief = await h.createUser({ balancePaise: 0n });
  const utr = nextUtr();
  await sendSms(sbiSms('400.00', utr));
  assert.equal((await submitUtr(payer, 400, utr)).body.status, 'SUCCESS');
  assert.equal((await submitUtr(thief, 400, utr)).status, 409);
  assert.equal((await h.getWallet(thief.id)).balance, 0n);
});

test('with the real-money switch off, deposits and withdrawals are refused and no UPI ID is shown', async () => {
  const user = await h.createUser({ balancePaise: 100000n });
  process.env.REAL_MONEY_ENABLED = 'false';
  try {
    const config = await http.request('GET', '/api/payments/config');
    assert.equal(config.body.data.enabled, false);
    assert.equal(config.body.data.upiId, '');
    assert.equal((await submitUtr(user, 500, nextUtr())).status, 503);
    const wd = await http.request('POST', '/api/ledger/withdraw/instant', { token: h.tokenFor(user), body: { amount: 500, upiId: 'me@oksbi' } });
    assert.equal(wd.status, 503);
    assert.equal((await h.getWallet(user.id)).balance, 100000n);
  } finally {
    process.env.REAL_MONEY_ENABLED = 'true';
  }
  const config = await http.request('GET', '/api/payments/config');
  assert.equal(config.body.data.enabled, true);
  assert.equal(config.body.data.upiId, 'test-merchant@upi');
});
