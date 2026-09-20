const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Universal Bet Panel Test Suite', () => {
  test('Verifies universal betting UI consistency, inputs, chips, calculations, states, and game integration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('--- Step 1: Navigating to Universal Bet Panel Demo ---');
    await page.goto('http://localhost:3000/games/bet-panel-demo', { waitUntil: 'domcontentloaded' });

    // Wait for React hydration
    await page.waitForSelector('[data-hydrated="true"]', { timeout: 15000 });
    console.log('✓ Bet Panel Demo loaded and hydrated');

    // 1. Verify Standard Variant Controls
    console.log('--- Step 2: Testing Standard Bet Panel Steppers & Quick Chips ---');
    const standardSection = page.locator('div:has-text("Standard Game Panel")').first();
    await expect(standardSection).toBeVisible();

    // Check default amount is ₹100
    const amountInput = page.locator('[data-testid="bet-amount-input"]').first();
    await expect(amountInput).toHaveValue('100');

    // Check potential win for 2.35x odds: 100 * 2.35 = 235.00
    const potentialWin = page.locator('[data-testid="potential-payout"]').first();
    const netProfit = page.locator('[data-testid="net-profit"]').first();
    await expect(potentialWin).toHaveText('₹235.00');
    await expect(netProfit).toHaveText('+₹135.00');
    console.log('✓ Potential payout and net profit calculated accurately for ₹100 @ 2.35x');

    // Click 2x multiplier
    const doubleBtn = page.locator('[data-testid="btn-double"]').first();
    await doubleBtn.click();
    await expect(amountInput).toHaveValue('200');
    await expect(potentialWin).toHaveText('₹470.00');
    await expect(netProfit).toHaveText('+₹270.00');
    console.log('✓ 2x double button works (₹200 stake -> ₹470 payout)');

    // Click 1/2 half multiplier
    const halfBtn = page.locator('[data-testid="btn-half"]').first();
    await halfBtn.click();
    await expect(amountInput).toHaveValue('100');
    console.log('✓ 1/2 half button works (₹100 stake)');

    // Click Quick Chip: 500
    const chip500 = page.locator('[data-testid="chip-500"]').first();
    await chip500.click();
    await expect(amountInput).toHaveValue('500');
    await expect(potentialWin).toHaveText('₹1175.00');
    console.log('✓ Quick chip 500 selected correctly');

    // Reset back to 100 with quick chip 100
    const chip100 = page.locator('[data-testid="chip-100"]').first();
    await chip100.click();
    await expect(amountInput).toHaveValue('100');

    // 2. Test Place Bet Flow (Loading -> Accepted)
    console.log('--- Step 3: Testing Bet Placement & Accepted State ---');
    const placeBetBtn = page.locator('[data-testid="btn-place-bet"]').first();
    await expect(placeBetBtn).toBeVisible();
    await placeBetBtn.click();

    // Verify Accepted state appears
    const acceptedBadge = page.locator('[data-testid="badge-accepted"]').first();
    await expect(acceptedBadge).toBeVisible({ timeout: 5000 });
    await expect(acceptedBadge).toContainText('Placed ₹100 on OVER 7');
    console.log('✓ Bet accepted state and confirmation badge verified');

    // 3. Test Test State Controls: Won Settlement
    console.log('--- Step 4: Testing Settlement Banner ---');
    const wonBtn = page.locator('button:text-is("Won")');
    await wonBtn.click();
    const settlementBanner = page.locator('[data-testid="settlement-banner"]').first();
    await expect(settlementBanner).toBeVisible();
    await expect(settlementBanner).toContainText('ROUND WON!');
    await expect(settlementBanner).toContainText('+₹200.00');
    console.log('✓ Settlement WON state banner verified');

    // 4. Test Locked / Open Toggle
    console.log('--- Step 5: Testing Locked State ---');
    const toggleLockBtn = page.locator('button:text-is("Open")');
    await toggleLockBtn.click();
    await expect(page.locator('text=Betting Locked').first()).toBeVisible();
    console.log('✓ Betting Locked state verified');

    // Restore to Open
    const toggleOpenBtn = page.locator('button:text-is("Locked")');
    await toggleOpenBtn.click();

    // 5. Test Crash Mode Variant
    console.log('--- Step 6: Testing Crash Mode Auto-Cashout Controls ---');
    const crashSection = page.locator('div:has-text("Crash Game Panel (Aviator)")').first();
    await expect(crashSection).toBeVisible();
    await expect(page.locator('text=Auto Cashout:').first()).toBeVisible();
    console.log('✓ Crash variant with Auto Cashout verified');

    // Capture screenshot of the Universal Bet Panel Demo
    const demoScreenshotPath = path.resolve(__dirname, 'universal_bet_panel_demo.png');
    await page.screenshot({ path: demoScreenshotPath, fullPage: true });
    console.log(`✓ Demo screenshot saved to ${demoScreenshotPath}`);

    // 6. Test Dice Game Integration
    console.log('--- Step 7: Navigating to Dice Game for Live Integration ---');
    await page.goto('http://localhost:3000/games/dice', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Sic Bo', { timeout: 15000 });

    // Verify Universal Bet Panel is rendered in the footer
    const diceBetPanel = page.locator('text=Dice Bet Engine');
    await expect(diceBetPanel).toBeVisible({ timeout: 10000 });
    console.log('✓ Universal Bet Panel present on Dice Game page');

    // Default market is BIG (2.00x)
    await expect(page.locator('text=BIG (2.00x)')).toBeVisible();

    // Click 'SMALL' market and verify Bet Panel updates market and odds to SMALL (2.00x)
    const smallBtn = page.locator('button:has-text("SMALL")').first();
    await smallBtn.click();
    await expect(page.locator('text=SMALL (2.00x)')).toBeVisible({ timeout: 5000 });
    console.log('✓ Bet Panel dynamically synced with selected game market & odds (SMALL 2.00x)');

    // Click '24:1' (ANY TRIPLE) and verify Bet Panel updates
    const anyTripleBtn = page.locator('button:has-text("24:1")').first();
    await anyTripleBtn.click();
    await expect(page.locator('text=TRIPLE ANY (25.00x)')).toBeVisible({ timeout: 5000 });
    console.log('✓ Bet Panel dynamically synced with selected game market & odds (TRIPLE ANY 25.00x)');

    // Capture screenshot of Dice Game with Universal Bet Panel
    const diceScreenshotPath = path.resolve(__dirname, 'dice_universal_bet_panel.png');
    await page.screenshot({ path: diceScreenshotPath, fullPage: true });
    console.log(`✓ Dice Game integration screenshot saved to ${diceScreenshotPath}`);

    console.log('--- All Universal Bet Panel Tests Passed Successfully! ---');
  });
});
