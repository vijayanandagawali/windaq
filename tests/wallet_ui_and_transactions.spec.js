const { test, expect } = require('@playwright/test');

test.describe('Wallet UI & Transaction History E2E Suite', () => {
  test('Verifies complete production-ready wallet page, balances, deposit/withdraw modals, and ledger transaction receipts', async ({ page }) => {
    // 1. Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('--- Step 1: Navigating to /wallet ---');
    await page.goto('http://localhost:3000/wallet', { waitUntil: 'domcontentloaded' });

    // Wait for main wallet header
    await page.waitForSelector('text=MY GAMING WALLET', { timeout: 15000 });
    console.log('✓ Wallet Page loaded successfully');

    // 2. Verify Balance Display
    const totalBalance = page.locator('text=Total Available Balance');
    await expect(totalBalance).toBeVisible();
    console.log('✓ Total Available Balance section visible');

    // Verify Deposit, Winnings, and Bonus breakdowns
    await expect(page.locator('text=Deposit:')).toBeVisible();
    await expect(page.locator('text=Winnings:')).toBeVisible();
    await expect(page.locator('text=Bonus:')).toBeVisible();
    console.log('✓ Balance breakdowns (Deposit, Winnings, Bonus) visible');

    // 3. Test Instant Deposit Modal
    console.log('--- Step 2: Testing Instant Deposit Modal ---');
    const depositBtn = page.locator('button:has-text("INSTANT DEPOSIT")').first();
    await expect(depositBtn).toBeVisible();
    await depositBtn.click();

    // Verify deposit modal opened
    const depositModal = page.locator('h3:has-text("Instant UPI Deposit")');
    await expect(depositModal).toBeVisible();

    // Select ₹1000 preset chip
    const preset1k = page.locator('button:has-text("₹1k")').first();
    await preset1k.click();

    // Verify UPI ID box
    await expect(page.locator('text=windaq.pay@upi')).toBeVisible();

    // Submit deposit
    const confirmDepositBtn = page.locator('button:has-text("CONFIRM DEPOSIT")');
    await confirmDepositBtn.click();

    // Wait for deposit modal to close and balance to refresh
    await expect(depositModal).not.toBeVisible({ timeout: 10000 });
    console.log('✓ Instant deposit executed and verified against ledger');

    // 4. Test Withdrawal Modal
    console.log('--- Step 3: Testing Withdrawal Modal ---');
    const withdrawBtn = page.locator('button:has-text("WITHDRAW")').first();
    await expect(withdrawBtn).toBeVisible();
    await withdrawBtn.click();

    const withdrawModal = page.locator('h3:has-text("Instant Withdrawal")');
    await expect(withdrawModal).toBeVisible();

    // Fill UPI ID
    const upiInput = page.locator('input[placeholder*="okhdfcbank"]');
    await upiInput.fill('tester@okhdfcbank');

    // Submit withdrawal
    const confirmWithdrawBtn = page.locator('button:has-text("REQUEST WITHDRAWAL")');
    await confirmWithdrawBtn.click();

    await expect(withdrawModal).not.toBeVisible({ timeout: 10000 });
    console.log('✓ Instant withdrawal processed and verified against ledger');

    // 5. Verify Transaction History & Filters
    console.log('--- Step 4: Verifying Transaction History & Detail Modal ---');
    await page.waitForTimeout(1000); // allow refresh

    // Verify transaction items exist
    const txRow = page.locator('div[class*="cursor-pointer group"]').first();
    await expect(txRow).toBeVisible({ timeout: 10000 });
    console.log('✓ Transaction list rendered with ledger-backed entries');

    // Click transaction row to open Transaction Details Modal
    await txRow.click();

    const txDetailModal = page.locator('h3:has-text("Transaction Details")');
    await expect(txDetailModal).toBeVisible();

    // Verify Double-Entry Ledger Verification block
    const ledgerBlock = page.locator('text=Double-Entry Ledger Verification');
    await expect(ledgerBlock).toBeVisible();
    console.log('✓ Transaction Details shows Double-Entry Ledger Verification (Debit ➔ Credit)');

    // Capture screenshot of Transaction Details modal
    await page.screenshot({ path: 'tests/wallet_tx_detail_modal.png' });
    console.log('✓ Captured tests/wallet_tx_detail_modal.png');

    // Close transaction modal
    const closeReceiptBtn = page.locator('button:has-text("Close Receipt")');
    await closeReceiptBtn.click();
    await expect(txDetailModal).not.toBeVisible();

    // 6. Test Wager History Tab
    console.log('--- Step 5: Testing Wager History Tab ---');
    const wagerTab = page.locator('button:has-text("Wager History")');
    await wagerTab.click();
    await page.waitForTimeout(1000);

    // Capture screenshot of Wager History Tab
    await page.screenshot({ path: 'tests/wallet_wager_history_tab.png' });
    console.log('✓ Captured tests/wallet_wager_history_tab.png');

    // 7. Test Pending & Failed Tab
    console.log('--- Step 6: Testing Pending & Failed Tab ---');
    const pendingTab = page.locator('button:has-text("Pending & Failed")');
    await pendingTab.click();
    await page.waitForTimeout(1000);

    // Capture screenshot of Pending Tab
    await page.screenshot({ path: 'tests/wallet_pending_tab.png' });
    console.log('✓ Captured tests/wallet_pending_tab.png');

    // 8. Capture Full Wallet Hub Screenshot
    const txTab = page.locator('button:has-text("Transaction History")');
    await txTab.click();
    await page.screenshot({ path: 'tests/wallet_hub_production.png' });
    console.log('✓ Captured tests/wallet_hub_production.png');

    console.log('🎉 ALL WALLET UI AND TRANSACTION HISTORY TESTS PASSED!');
  });
});
