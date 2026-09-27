const { expect } = require('@playwright/test');
const { E2E } = require('./constants');

let phoneCounter = 0;

/** A fresh, valid Indian mobile number for each test player. */
function uniquePhone() {
  phoneCounter += 1;
  const tail = `${Date.now() % 100000}`.padStart(5, '0') + String(phoneCounter % 10);
  return `98${tail.slice(-8)}`.padEnd(10, '0').slice(0, 10);
}

/** Logs in through the real auth modal (send OTP → enter OTP → sign in). */
async function loginViaUi(page, phone, { path = '/wallet' } = {}) {
  await page.goto(path);
  await page.getByText('SIGN IN / REGISTER').first().click();
  await page.getByPlaceholder('9876543210').fill(phone);
  await page.getByText('Send OTP via SMS').click();
  await page.getByPlaceholder('Enter 6-digit OTP').fill(E2E.otp);
  await page.getByText('SECURE SIGN IN').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('windaq_auth_token'))).toBeTruthy();
}

async function tokenFromPage(page) {
  return page.evaluate(() => localStorage.getItem('windaq_auth_token'));
}

/** Direct backend login (used for set-up steps that are not under test). */
async function apiLogin(request, phone) {
  const send = await request.post(`${E2E.backendUrl}/api/auth/send-otp`, { data: { phone } });
  // A 429 cooldown means a code was already issued moments ago, which is fine for the fixed dev OTP.
  expect([200, 429]).toContain(send.status());
  const res = await request.post(`${E2E.backendUrl}/api/auth/login`, { data: { phone, otp: E2E.otp } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.token;
}

async function apiBalance(request, token) {
  const res = await request.get(`${E2E.backendUrl}/api/ledger/balance`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** Funds a player the legitimate way: deposit request + finance approval. */
async function fundPlayer(request, playerToken, amountInr, utr) {
  const dep = await request.post(`${E2E.backendUrl}/api/ledger/deposit/instant`, {
    headers: { Authorization: `Bearer ${playerToken}` },
    data: { amount: amountInr, utr }
  });
  expect(dep.status()).toBe(202);
  const { data } = await dep.json();
  const financeToken = await apiLogin(request, E2E.finance.phone);
  const approve = await request.post(`${E2E.backendUrl}/api/payments/admin/deposits/${data.intentId}/approve`, {
    headers: { Authorization: `Bearer ${financeToken}` },
    data: { note: 'e2e funding' }
  });
  expect(approve.ok()).toBeTruthy();
}

module.exports = { uniquePhone, loginViaUi, tokenFromPage, apiLogin, apiBalance, fundPlayer };
