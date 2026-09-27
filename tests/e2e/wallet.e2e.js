const { test, expect } = require('@playwright/test');
const { E2E } = require('./support/constants');
const { uniquePhone, loginViaUi, tokenFromPage, apiLogin, apiBalance } = require('./support/flows');

test('deposit is credited only after finance verifies it, exactly once', async ({ page, browser, request }) => {
  const phone = uniquePhone();
  await loginViaUi(page, phone);
  const playerToken = await tokenFromPage(page);

  // New accounts start at zero — no unbacked credit.
  expect((await apiBalance(request, playerToken)).balancePaise).toBe('0');

  // Player submits a deposit with a UTR through the deposit modal.
  await page.getByRole('button', { name: /^DEPOSIT$/ }).first().click();
  await page.getByRole('button', { name: /PROCEED TO PAY/ }).click();
  await expect(page.getByText(E2E.merchantUpi)).toBeVisible();
  const utr = `7${Date.now()}`.slice(0, 12);
  await page.getByPlaceholder('e.g. 423985729104').fill(utr);
  await page.getByRole('button', { name: 'CONFIRM' }).click();
  await expect(page.getByRole('heading', { name: 'Deposit Submitted' })).toBeVisible();
  await expect(page.getByText('Awaiting verification')).toBeVisible();

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
