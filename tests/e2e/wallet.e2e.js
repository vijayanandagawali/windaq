const { test, expect } = require('@playwright/test');
const { E2E } = require('./support/constants');
const { uniquePhone, loginViaUi, tokenFromPage, apiLogin, apiBalance } = require('./support/flows');

async function submitDepositViaUi(page, utr) {
  await page.getByRole('button', { name: /^DEPOSIT$/ }).first().click();
  await page.getByTestId('deposit-preset-1000').click();
  await page.getByRole('button', { name: /Continue to pay/ }).click();
  await expect(page.getByText(E2E.merchantUpi)).toBeVisible();
  await expect(page.getByAltText(/UPI QR code/)).toBeVisible();
  await page.getByLabel('After paying, enter the 12-digit UTR').fill(utr);
  await page.getByRole('button', { name: 'Submit' }).click();
}

test('a deposit is credited automatically when the bank credit SMS arrives', async ({ page, request }) => {
  const phone = uniquePhone();
  await loginViaUi(page, phone);
  const playerToken = await tokenFromPage(page);
  const utr = `5${Date.now()}`.slice(0, 12);

  await submitDepositViaUi(page, utr);
  await expect(page.getByRole('heading', { name: 'Waiting for the bank to confirm' })).toBeVisible();
  expect((await apiBalance(request, playerToken)).balancePaise).toBe('0');

  // The merchant's phone forwards the bank SMS.
  const sms = await request.post(`${E2E.backendUrl}/api/payments/bank-sms`, {
    headers: { 'x-windaq-sms-token': E2E.bankSmsToken },
    data: { from: 'AD-SBIUPI', text: `Dear UPI user A/C X1234 credited by Rs1000.00 on date 28Sep26 trf from E2E PLAYER Refno ${utr}. -SBI`, receivedStamp: Date.now() }
  });
  expect((await sms.json()).matched).toBe(true);

  await expect(page.getByRole('heading', { name: '₹1,000 added' })).toBeVisible({ timeout: 15000 });
  expect((await apiBalance(request, playerToken)).balancePaise).toBe('100000');
});

test('an unmatched deposit is credited only after finance verifies it, exactly once', async ({ page, browser, request }) => {
  const phone = uniquePhone();
  await loginViaUi(page, phone);
  const playerToken = await tokenFromPage(page);

  // New accounts start at zero — no unbacked credit.
  expect((await apiBalance(request, playerToken)).balancePaise).toBe('0');

  // Player submits a deposit with a UTR through the deposit modal.
  const utr = `7${Date.now()}`.slice(0, 12);
  await submitDepositViaUi(page, utr);
  await expect(page.getByRole('heading', { name: 'Waiting for the bank to confirm' })).toBeVisible();

  // Still not credited.
  expect((await apiBalance(request, playerToken)).balancePaise).toBe('0');

  // Finance operator approves in the admin console.
  const financeContext = await browser.newContext();
  const financePage = await financeContext.newPage();
  await loginViaUi(financePage, E2E.finance.phone, { path: '/admin/payments' });
  await financePage.goto('/admin/payments');
  const row = financePage.getByRole('row', { name: new RegExp(utr) });
  await expect(row).toBeVisible();
  financePage.once('dialog', (dialog) => dialog.accept('UTR matched on statement'));
  await row.getByRole('button', { name: 'Verify & Credit' }).click();
  await expect(financePage.getByText('No pending deposits to review.')).toBeVisible();

  const balance = await apiBalance(request, playerToken);
  expect(balance.balancePaise).toBe('100000');
  expect(balance.pendingDeposit).toBe(0);

  // The request cannot be approved again.
  const financeToken = await apiLogin(request, E2E.finance.phone);
  const pending = await request.get(`${E2E.backendUrl}/api/ledger/transactions`, { headers: { Authorization: `Bearer ${playerToken}` } });
  expect(pending.ok()).toBeTruthy();
  const intents = await request.get(`${E2E.backendUrl}/api/payments/admin/deposits/pending`, { headers: { Authorization: `Bearer ${financeToken}` } });
  expect((await intents.json()).data).toHaveLength(0);

  await financeContext.close();
});

test('withdrawal holds funds until finance decides; rejection returns them', async ({ page, browser, request }) => {
  const phone = uniquePhone();
  const playerToken = await apiLogin(request, phone);

  // Fund via the legitimate flow.
  const dep = await request.post(`${E2E.backendUrl}/api/ledger/deposit/instant`, {
    headers: { Authorization: `Bearer ${playerToken}` }, data: { amount: 1000, utr: `8${Date.now()}`.slice(0, 12) }
  });
  const financeToken = await apiLogin(request, E2E.finance.phone);
  await request.post(`${E2E.backendUrl}/api/payments/admin/deposits/${(await dep.json()).data.intentId}/approve`, {
    headers: { Authorization: `Bearer ${financeToken}` }, data: { note: 'fund' }
  });

  const wd = await request.post(`${E2E.backendUrl}/api/ledger/withdraw/instant`, {
    headers: { Authorization: `Bearer ${playerToken}` }, data: { amount: 400, upiId: 'e2e.player@okaxis' }
  });
  expect(wd.status()).toBe(202);
  let bal = await apiBalance(request, playerToken);
  expect(bal.availableBalancePaise).toBe('60000');
  expect(bal.lockedBalancePaise).toBe('40000');

  const financeContext = await browser.newContext();
  const financePage = await financeContext.newPage();
  await loginViaUi(financePage, E2E.finance.phone, { path: '/admin/payments' });
  await financePage.goto('/admin/payments');
  await financePage.getByRole('tab', { name: /Pending withdrawals/ }).click();
  const row = financePage.getByRole('row', { name: /e2e\.player@okaxis/ });
  await expect(row).toBeVisible();
  financePage.once('dialog', (dialog) => dialog.accept('Name mismatch on UPI'));
  await row.getByRole('button', { name: 'Reject' }).click();
  await expect(financePage.getByText('No pending withdrawals to review.')).toBeVisible();

  bal = await apiBalance(request, playerToken);
  expect(bal.availableBalancePaise).toBe('100000');
  expect(bal.lockedBalancePaise).toBe('0');
  await financeContext.close();
});
