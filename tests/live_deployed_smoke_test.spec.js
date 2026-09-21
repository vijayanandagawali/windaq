const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');

// Current production Vercel deployment URL
const LIVE_BASE = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://windaq.vercel.app';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-fallback';

test.describe('WINDAQ PROMPT #63 — LIVE VERCEL CINEMATIC ANIMATION & REVEAL ENGINE VERIFICATION', () => {

  const testToken = jwt.sign(
    { userId: 'TEST_SMOKE_USER', phone: '+919999990001', role: 'SUPER_ADMIN' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_token', token);
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_id', 'TEST_SMOKE_USER');
      localStorage.setItem('windaq_user_data', JSON.stringify({ id: 'TEST_SMOKE_USER', phone: '+919999990001', role: 'SUPER_ADMIN' }));
    }, { token: testToken });
  });

  test('Live Smoke 1: Deployed Home & Navigation Bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(`Navigating to Live Home: ${LIVE_BASE}...`);
    const res = await page.goto(LIVE_BASE, { waitUntil: 'domcontentloaded' });
    expect(res.status()).toBeLessThan(400);

    // Verify Title / Branding
    await expect(page.locator('text=WINDAQ').first()).toBeVisible({ timeout: 15000 });
    console.log('✓ Live Deployed Home loaded successfully');
  });

  test('Live Smoke 2: Deployed European Roulette Cinematic Wheel Canvas & Bets', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(`Navigating to Live European Roulette: ${LIVE_BASE}/games/european-roulette...`);
    await page.goto(`${LIVE_BASE}/games/european-roulette`, { waitUntil: 'domcontentloaded' });

    // Verify Canvas Roulette Wheel is visible and rendering
    const wheelCanvas = page.locator('canvas').first();
    await expect(wheelCanvas).toBeVisible({ timeout: 20000 });

    // Verify betting layout numbers exist
    const numberZero = page.locator('button:has-text("0")').first();
    await expect(numberZero).toBeVisible();

    await page.screenshot({ path: 'tests/live_deployed_roulette.png' });
    console.log('✓ Live Deployed European Roulette wheel canvas and bets verified');
  });

  test('Live Smoke 3: Deployed Card Game (Dragon Tiger 3D Card Engine)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(`Navigating to Live Dragon Tiger: ${LIVE_BASE}/games/dragon-tiger...`);
    await page.goto(`${LIVE_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('text=SIMULATED LIVE TABLE')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=VS').first()).toBeVisible();

    // Verify Result History button and drawer
    const historyBtn = page.locator('button[title*="Result History"]').or(page.locator('button:has-text("History")')).first();
    await expect(historyBtn).toBeVisible({ timeout: 10000 });
    await historyBtn.click();
    await expect(page.locator('text=OFFICIAL RESULT HISTORY')).toBeVisible({ timeout: 8000 });

    await page.screenshot({ path: 'tests/live_deployed_card_game.png' });
    console.log('✓ Live Deployed Dragon Tiger card engine and history verified');
  });

  test('Live Smoke 4: Deployed Lotto / Quick Draw Sequential Chute', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(`Navigating to Live Lotto: ${LIVE_BASE}/games/lotto...`);
    await page.goto(`${LIVE_BASE}/games/lotto`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('text=Next Draw In', { timeout: 20000 });
    await expect(page.locator('button:has-text("Buy Ticket")').first()).toBeVisible();

    await page.screenshot({ path: 'tests/live_deployed_lotto.png' });
    console.log('✓ Live Deployed Lotto chute & draw stage verified');
  });

  test('Live Smoke 5: Deployed Crash (Aviator) Flight Trajectory Stage', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log(`Navigating to Live Aviator: ${LIVE_BASE}/games/aviator...`);
    await page.goto(`${LIVE_BASE}/games/aviator`, { waitUntil: 'domcontentloaded' });

    const flightCanvas = page.locator('canvas').first();
    await expect(flightCanvas).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: 'tests/live_deployed_aviator.png' });
    console.log('✓ Live Deployed Aviator stage verified');
  });

});
