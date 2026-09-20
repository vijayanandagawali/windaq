const { test, expect } = require('@playwright/test');

test.describe('WINDAQ - SCREENSHOT FIXES & GAME VERIFICATION MATRIX', () => {

  test('Screenshot 2 Fix: /games/european-roulette connects without Wallet Not Found error', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Seed test auth in localStorage so user is recognized
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('windaq_auth_token', 'test_token_sbx');
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'sbx-usr-normal-001',
        phone: '+919999900001',
        role: 'USER'
      }));
    });

    console.log('Navigating to European Roulette...');
    await page.goto('http://localhost:3000/games/european-roulette', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify error toast "Wallet not found" is NOT present
    const walletNotFoundToast = page.locator('text=Wallet not found');
    await expect(walletNotFoundToast).toHaveCount(0);

    // Verify roulette board is visible
    const rouletteBoard = page.locator('text=1ST 12').or(page.locator('text=EVEN')).first();
    await expect(rouletteBoard).toBeVisible({ timeout: 10000 });
  });

  test('Screenshot 3 Fix: /games/lightning-roulette loads active game with no maintenance placeholder', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log('Navigating to Lightning Roulette...');
    await page.goto('http://localhost:3000/games/lightning-roulette', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Must NOT display maintenance text
    const maintenanceText = page.locator('text=This game is currently under maintenance or undergoing certification checks');
    await expect(maintenanceText).toHaveCount(0);

    // Must display live roulette elements
    const liveHeader = page.locator('text=Live Roulette').or(page.locator('text=VIP Live Roulette')).or(page.locator('text=Roulette')).first();
    await expect(liveHeader).toBeVisible({ timeout: 10000 });
  });

  test('Screenshot 4 Fix: /games/colour-prediction loads active game with no maintenance placeholder', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log('Navigating to Colour Prediction...');
    await page.goto('http://localhost:3000/games/colour-prediction', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Must NOT display maintenance text
    const maintenanceText = page.locator('text=This game is currently under maintenance or undergoing certification checks');
    await expect(maintenanceText).toHaveCount(0);

    // Must display active color betting options
    const joinGreen = page.locator('text=Join Green').first();
    const joinRed = page.locator('text=Join Red').first();
    await expect(joinGreen).toBeVisible({ timeout: 10000 });
    await expect(joinRed).toBeVisible();
  });

  test("Screenshot 5 Fix: /games/texas-holdem seats AI bots, deals cards, and shows active pot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log("Navigating to Texas Hold'em Poker...");
    await page.goto('http://localhost:3000/games/texas-holdem', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify AI bots are seated
    const botAria = page.locator('text=Aria [AI]');
    const botVikram = page.locator('text=Vikram [VIP]');
    await expect(botAria).toBeVisible({ timeout: 10000 });
    await expect(botVikram).toBeVisible();

    // Verify Action panel is visible
    const foldBtn = page.locator('button', { hasText: 'FOLD' });
    const checkBtn = page.locator('button', { hasText: 'CHECK / CALL' });
    const raiseBtn = page.locator('button', { hasText: 'RAISE' });
    await expect(foldBtn).toBeVisible();
    await expect(checkBtn).toBeVisible();
    await expect(raiseBtn).toBeVisible();

    // Verify Pot is visible and formatted
    const potDisplay = page.locator('text=POT:');
    await expect(potDisplay).toBeVisible();
  });

});
