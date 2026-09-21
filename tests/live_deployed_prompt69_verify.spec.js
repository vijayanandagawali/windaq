const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('PROMPT #69 LIVE PRODUCTION SMOKE TEST (https://daqwon.in)', () => {

  test('Verifies live production deployment at https://daqwon.in/wallet and reconciliation', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('--- Step 1: Navigating to https://daqwon.in/wallet ---');
    
    // Inject test session
    await page.addInitScript(() => {
      localStorage.setItem('windaq_user_id', 'f6ad4742-e550-4bd5-8830-6e5aecd3c0b7');
      localStorage.setItem('windaq_auth_token', 'windaq_' + btoa(JSON.stringify({
        id: 'f6ad4742-e550-4bd5-8830-6e5aecd3c0b7',
        phone: '+919999900069',
        role: 'ADMIN',
        exp: Date.now() + 86400000
      })));
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'f6ad4742-e550-4bd5-8830-6e5aecd3c0b7',
        phone: '+919999900069',
        role: 'ADMIN'
      }));
    });

    await page.goto('https://daqwon.in/wallet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Verify main title
    await expect(page.locator('text=MY GAMING WALLET').first()).toBeVisible({ timeout: 15000 });
    console.log('✓ Live /wallet page loaded successfully on https://daqwon.in');

    await page.screenshot({ path: path.join(__dirname, 'live_deployed_wallet_prompt69.png') });

    // Step 2: Test Admin Reconciliation page on production
    console.log('--- Step 2: Navigating to https://daqwon.in/admin/reconciliation ---');
    await page.goto('https://daqwon.in/admin/reconciliation', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const titleElem = page.locator('text=Wallet Reconciliation Engine').or(page.locator('text=Reconciliation'));
    await expect(titleElem.first()).toBeVisible({ timeout: 15000 });
    console.log('✓ Live /admin/reconciliation loaded successfully on https://daqwon.in');

    await page.screenshot({ path: path.join(__dirname, 'live_deployed_admin_reconciliation_prompt69.png') });
  });

});
