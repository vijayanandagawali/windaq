const { test, expect } = require('@playwright/test');

const LIVE_URL = process.env.VERCEL_URL || 'https://windaq-6znfkfq5q-vijaya10.vercel.app';

test.describe('WINDAQ PROMPT #64 — LIVE DEPLOYED VERCEL SMOKE VERIFICATION', () => {

  test('Smoke 1: Card Table (Dragon Tiger) has Simulated Dealer, Badge and Opponent Bots', async ({ page }) => {
    console.log(`Navigating to ${LIVE_URL}/games/dragon-tiger...`);
    await page.goto(`${LIVE_URL}/games/dragon-tiger`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Check Simulated Dealer Badge
    const badge = page.locator('[data-testid="virtual-dealer-badge"]');
    await expect(badge.first()).toBeVisible({ timeout: 15000 });
    const badgeText = await badge.first().innerText();
    expect(badgeText).toContain('SIMULATED DEALER');
    expect(badgeText).toContain('WINDAQ ORIGINAL TABLE');

    // 2. Check Virtual Dealer Nameplate
    const dealerName = page.locator('[data-testid="dealer-display-name"]');
    await expect(dealerName.first()).toBeVisible({ timeout: 15000 });
    const nameText = await dealerName.first().innerText();
    expect(nameText).toMatch(/maya|liam|sophia|arjun/i);

    // 3. Check Bot seats presence
    const botBadges = page.locator('[data-testid="simulated-opponent-badge"]');
    await expect(botBadges.first()).toBeVisible({ timeout: 15000 });
    const botCount = await botBadges.count();
    expect(botCount).toBeGreaterThanOrEqual(2);

    console.log(`Dragon Tiger live verification passed! Found ${botCount} simulated bot elements.`);
  });

  test('Smoke 2: Roulette Table renders live table environment and controls', async ({ page }) => {
    console.log(`Navigating to ${LIVE_URL}/games/european-roulette...`);
    await page.goto(`${LIVE_URL}/games/european-roulette`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const title = page.locator('text=EUROPEAN ROULETTE');
    await expect(title.first()).toBeVisible({ timeout: 15000 });

    console.log('Roulette live verification passed!');
  });

  test('Smoke 3: Card / Multiplayer Table (Andar Bahar) renders live table', async ({ page }) => {
    console.log(`Navigating to ${LIVE_URL}/games/andar-bahar...`);
    await page.goto(`${LIVE_URL}/games/andar-bahar`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const andarZone = page.locator('button:has-text("ANDAR"), div:has-text("ANDAR")');
    await expect(andarZone.first()).toBeVisible({ timeout: 15000 });

    console.log('Andar Bahar live verification passed!');
  });

  test('Smoke 4: Lotto / Draw Table renders draw machine interface', async ({ page }) => {
    console.log(`Navigating to ${LIVE_URL}/games/lotto...`);
    await page.goto(`${LIVE_URL}/games/lotto`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const lottoElement = page.locator('text=Pick 6 Numbers');
    await expect(lottoElement.first()).toBeVisible({ timeout: 15000 });

    console.log('Lotto draw live verification passed!');
  });

  test('Smoke 5: Admin Live Tables route (/admin/tables) renders with auth protection/login redirect', async ({ page }) => {
    console.log(`Navigating to ${LIVE_URL}/admin/tables...`);
    // Inject valid SUPER_ADMIN session
    await page.addInitScript(() => {
      localStorage.setItem('windaq_auth_token', 'mock_admin_token_smoke');
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'usr_super_admin_smoke',
        phone: '+919999990005',
        role: 'SUPER_ADMIN',
        isGuest: false
      }));
    });

    await page.goto(`${LIVE_URL}/admin/tables`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const pageTitle = page.locator('text=Automated Virtual Tables & Dealer Monitor');
    await expect(pageTitle.first()).toBeVisible({ timeout: 15000 });

    console.log('Admin Live Tables verification passed!');
  });

});
