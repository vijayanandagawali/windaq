const { test, expect } = require('@playwright/test');
const { uniquePhone, loginViaUi, tokenFromPage, apiBalance, fundPlayer } = require('./support/flows');

/**
 * Plays real Aviator rounds through the UI. Rounds are live (~20 s cycle), so the test waits for the
 * betting window and then cashes out as soon as the plane is flying. If a round crashes before the
 * cashout lands, the bet is settled as a loss; either way wallet and server must agree.
 */
test('bet and cashout are settled by the server and reflected in the wallet', async ({ page, request }) => {
  test.setTimeout(6 * 60_000);
  const phone = uniquePhone();
  await loginViaUi(page, phone);
  const token = await tokenFromPage(page);
  await fundPlayer(request, token, 500, `9${Date.now()}`.slice(0, 12));

  await page.goto('/games/aviator');
  await expect(page.getByText('Balance: ₹500.00')).toBeVisible();

  const betButton = page.getByRole('button', { name: 'BET', exact: true }).first();
  const cashButton = page.getByRole('button', { name: /CASH OUT/ }).first();

  // Wait for a fresh betting window: the panel shows "Waiting..." during flight/crash, then "BET".
  // Flights have a heavy-tailed crash point (1000x takes ~70 s), so allow for long rounds.
  const LONG_ROUND_MS = 120_000;
  await expect(page.getByRole('button', { name: /waiting/i }).first()).toBeVisible({ timeout: LONG_ROUND_MS });
  await expect(betButton).toBeEnabled({ timeout: LONG_ROUND_MS });
  await betButton.click();
  await expect(page.getByText('Bet placed: ₹100')).toBeVisible();
  await expect(page.getByText('Balance: ₹400.00')).toBeVisible();

  // Cash out as soon as the button becomes enabled (plane flying).
  await expect(cashButton).toBeEnabled({ timeout: LONG_ROUND_MS });
  await cashButton.click().catch(() => {});

  // Outcome: either a server-confirmed cashout toast, or the round crashed first (loss).
  // Read the toast immediately — toasts auto-dismiss after a few seconds.
  const toast = await page.getByText(/Cashed out at \d+\.\d\dx/).first()
    .textContent({ timeout: 15_000 })
    .catch(() => null);
  await page.waitForTimeout(6_000); // allow round settlement to complete

  const bal = await apiBalance(request, token);
  const balancePaise = BigInt(bal.balancePaise);
  if (toast) {
    const payout = Number(toast.match(/₹([\d.]+)/)[1]);
    expect(balancePaise).toBe(40000n + BigInt(Math.round(payout * 100)));
    expect(payout).toBeGreaterThanOrEqual(100);
  } else {
    expect(balancePaise).toBe(40000n);
  }
  // UI shows the same authoritative balance.
  await expect(page.getByText(`Balance: ₹${(Number(balancePaise) / 100).toFixed(2)}`)).toBeVisible();
});
