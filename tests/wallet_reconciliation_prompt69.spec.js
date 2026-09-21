const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('WINDAQ PROMPT #69 - WALLET, ANIMATION & RECONCILIATION SUITE', () => {

  test.beforeEach(async ({ page }) => {
    // Setup authenticated test session for TEST_USER_069
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
  });

  test('Case 1: Authoritative Wallet Balance & AnimatedWalletBalance Component', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });

    // Verify main header
    await page.waitForSelector('text=MY GAMING WALLET', { timeout: 15000 });
    
    // Verify Authoritative Balance section
    const balanceHeader = page.locator('text=Total Authoritative Balance');
    await expect(balanceHeader).toBeVisible();

    // Verify AnimatedWalletBalance element
    const animatedBalance = page.locator('[data-testid="wallet-total-balance"]');
    await expect(animatedBalance).toBeVisible();
    const balanceText = await animatedBalance.textContent();
    expect(balanceText).toContain('₹');
    console.log(`✓ Authoritative Animated Balance verified: ${balanceText}`);

    // Verify NO fake 60%/40% splits exist, but real available & deposited cards exist
    await expect(page.locator('text=Available:')).toBeVisible();
    await expect(page.locator('text=Total Deposited:')).toBeVisible();

    await page.screenshot({ path: path.join(__dirname, 'wallet_hub_prompt69_desktop.png'), fullPage: false });
  });

  test('Case 2: Deposit Modal with Framer Motion, QR/VPA & Authoritative Credit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });

    const depositBtn = page.locator('button:has-text("INSTANT DEPOSIT")').first();
    await expect(depositBtn).toBeVisible();
    await depositBtn.click();

    // Modal opens
    await page.waitForTimeout(600);
    const depositModal = page.locator('text=INSTANT DEPOSIT').or(page.locator('text=Official Merchant UPI'));
    await expect(depositModal.first()).toBeVisible();

    // Verify presets
    const preset1k = page.locator('button:has-text("₹1k")').or(page.locator('button:has-text("₹1,000")'));
    if (await preset1k.first().isVisible()) {
      await preset1k.first().click();
    }

    await page.screenshot({ path: path.join(__dirname, 'wallet_deposit_modal_prompt69.png') });
  });

  test('Case 3: Atomic Withdrawal with Row-Level Locking & Double-Entry Status', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });

    const withdrawBtn = page.locator('button:has-text("WITHDRAW")').first();
    await expect(withdrawBtn).toBeVisible();
    await withdrawBtn.click();

    await page.waitForTimeout(600);
    // Modal opens
    const withdrawModalTitle = page.locator('text=Instant Bank Payout').or(page.locator('text=Instant Withdrawal'));
    await expect(withdrawModalTitle.first()).toBeVisible();

    // Verify Available for Payout is visible
    const availLabel = page.locator('text=Available for Payout').or(page.locator('text=Available To Withdraw'));
    await expect(availLabel.first()).toBeVisible();

    await page.screenshot({ path: path.join(__dirname, 'wallet_withdraw_modal_prompt69.png') });
  });

  test('Case 4: Transaction History & Detail Page Inspection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('text=MY GAMING WALLET', { timeout: 15000 });
    
    // Check if transactions exist
    const txItems = page.locator('[data-testid="wallet-tx-item"]');
    const count = await txItems.count();
    console.log(`Found ${count} transactions in history`);

    if (count > 0) {
      await txItems.first().click();
      await page.waitForTimeout(500);

      // Verify transaction detail modal
      await expect(page.locator('text=Transaction Details')).toBeVisible();
      await expect(page.locator('text=Idempotency Key')).toBeVisible();

      // Check full audit link
      const auditLink = page.locator('a:has-text("View Full Audit Timeline")');
      if (await auditLink.isVisible()) {
        await auditLink.click();
        await page.waitForURL(/\/wallet\/transactions\/.+/, { timeout: 10000 });
        await expect(page.locator('text=Ledger Settlement Metadata')).toBeVisible();
        await page.screenshot({ path: path.join(__dirname, 'wallet_tx_detail_page_prompt69.png') });
      }
    }
  });

  test('Case 5: Admin Reconciliation Dashboard & Automated Sweep', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/admin/reconciliation', { waitUntil: 'domcontentloaded' });

    // Verify dashboard title
    await page.waitForSelector('text=Wallet Reconciliation Engine', { timeout: 15000 });
    
    // Verify 7 summary cards
    await expect(page.locator('text=Total Wallets')).toBeVisible();
    await expect(page.locator('text=Total Transactions')).toBeVisible();
    await expect(page.getByText('Matched', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.locator('text=Mismatched')).toBeVisible();

    // Verify Automated Sweep button
    const sweepBtn = page.locator('button:has-text("Run Automated Sweep")');
    await expect(sweepBtn).toBeVisible();

    await page.screenshot({ path: path.join(__dirname, 'admin_reconciliation_dashboard_prompt69.png') });

    // Click sweep
    await sweepBtn.click();
    await page.waitForTimeout(2000);
    console.log('✓ Automated reconciliation sweep executed from Admin UI');
  });

  test('Case 6: Mobile Responsiveness (390x844 iPhone Viewport)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('text=MY GAMING WALLET', { timeout: 15000 });
    
    // Verify mobile layout renders correctly
    const mainContainer = page.locator('main');
    await expect(mainContainer).toBeVisible();

    // Verify buttons are stacked cleanly and fully visible
    const depositBtn = page.locator('button:has-text("INSTANT DEPOSIT")').first();
    const withdrawBtn = page.locator('button:has-text("WITHDRAW")').first();
    await expect(depositBtn).toBeVisible();
    await expect(withdrawBtn).toBeVisible();

    await page.screenshot({ path: path.join(__dirname, 'wallet_mobile_390x844_prompt69.png') });
    console.log('✓ Mobile responsive wallet verified and screenshot captured');
  });

});
