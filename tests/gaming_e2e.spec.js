const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Chaska Real-Money Gaming Platform E2E Tests', () => {
  test.use({
    viewport: { width: 412, height: 915 }, // Pixel 7
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  });

  test('Complete End-to-End Platform Flow', async ({ page }) => {
    // 1. Visit Homepage
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/WinDaq/);

    // Verify Brand, Marquee, Banners
    await expect(page.locator('.brand-title')).toHaveText(/WINDAQ/);
    await expect(page.locator('#live-winners-marquee')).toBeVisible();
    await expect(page.locator('.banner-card')).toBeVisible();

    // Verify Games Grid has all games
    const gameCards = page.locator('.game-card');
    await expect(gameCards).toHaveCount(9);

    // Save screenshot of Mobile Home
    await page.screenshot({ path: 'chaska_app_home.png' });

    // 2. Test Category Filtering
    await page.locator('.cat-pill', { hasText: 'Crash Games' }).click();
    await expect(page.locator('.game-card')).toHaveCount(2); // Aviator & Mines

    await page.locator('.cat-pill', { hasText: 'All Games' }).click();
    await expect(page.locator('.game-card')).toHaveCount(9);

    // 3. Test Aviator Launch & Play
    await page.locator('.game-card', { hasText: 'Aviator' }).click();
    await expect(page.locator('#game-viewport-modal')).toHaveClass(/open/);
    await expect(page.locator('#aviator-canvas')).toBeVisible();
    await expect(page.locator('#aviator-big-mult')).toBeVisible();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'chaska_game_aviator.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 4. Test Wingo Color Prediction Launch
    await page.locator('.game-card', { hasText: 'Wingo' }).click();
    await expect(page.locator('#wingo-timer')).toBeVisible();
    await expect(page.locator('button', { hasText: 'GREEN' })).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'chaska_game_wingo.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 5. Test European Roulette Launch & Spin
    await page.locator('.game-card', { hasText: 'European Roulette' }).click();
    await expect(page.locator('#roulette-wheel-canvas')).toBeVisible();
    await page.locator('button', { hasText: 'RED (2X)' }).click();
    await expect(page.locator('#roulette-total-bet')).toHaveText(/₹50/);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'chaska_game_roulette.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 6. Test Dragon vs Tiger Launch
    await page.locator('.game-card', { hasText: 'Dragon vs Tiger' }).click();
    await expect(page.locator('#dragon-card-box')).toBeVisible();
    await expect(page.locator('#tiger-card-box')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'chaska_game_dragontiger.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 7. Test Mines 5x5 Launch
    await page.locator('.game-card', { hasText: 'Mines' }).click();
    await expect(page.locator('.mine-tile')).toHaveCount(25);
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'chaska_game_mines.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 8. Test 777 Slots Launch
    await page.locator('.game-card', { hasText: 'Vegas 777' }).click();
    await expect(page.locator('#slot-spin-btn')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'chaska_game_slots.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 9. Test Cricket Exchange Launch
    await page.locator('.game-card', { hasText: 'Cricket Exchange' }).click();
    await expect(page.locator('text=India vs Australia')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'chaska_game_cricket.png' });
    await page.locator('.game-viewport-bar button', { hasText: 'LOBBY' }).click();

    // 10. Test Deposit Modal & UPI Flow
    await page.locator('.open-deposit-btn').first().click();
    await expect(page.locator('#deposit-modal')).toHaveClass(/open/);
    await expect(page.locator('text=SCAN WITH ANY UPI APP')).toBeVisible();
    await page.screenshot({ path: 'chaska_modal_deposit.png' });
    await page.locator('#deposit-modal .modal-close').click();

    // 11. Test Admin Dashboard
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toHaveText(/WINDAQ/);
    await expect(page.locator('#admin-active-rtp')).toBeVisible();
    await page.locator('#rtp-admin').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'chaska_admin_dashboard.png' });
  });
});
