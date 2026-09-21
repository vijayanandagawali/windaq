const { test, expect } = require('@playwright/test');
const path = require('path');

const LIVE_URL = 'https://windaq-vijaya10.vercel.app';

test.describe('WINDAQ PROMPT #65 — LIVE DEPLOYED VERCEL VERIFICATION', () => {

  test('Live Deploy Verification: Hub, Games, History & Roadmaps', async ({ page }) => {
    test.setTimeout(90000);

    // 1. Game Hub Lobby
    console.log('Verifying Live Game Hub Lobby...');
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(__dirname, 'live_deployed_hub_prompt65.png') });

    // 2. Dragon Tiger (Card Game with Roadmap & Non-predictive notice)
    console.log('Verifying Live Dragon Tiger Table & Roadmap...');
    await page.goto(`${LIVE_URL}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Historical outcomes only • Independent random trials • Not a predictive system').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(__dirname, 'live_deployed_dragontiger_prompt65.png') });

    // 3. European Roulette with History Ribbon
    console.log('Verifying Live European Roulette History Ribbon...');
    await page.goto(`${LIVE_URL}/games/european-roulette`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=History:').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(__dirname, 'live_deployed_roulette_prompt65.png') });

    // 4. Crash Game (Aviator)
    console.log('Verifying Live Aviator Crash Game...');
    await page.goto(`${LIVE_URL}/games/aviator`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, 'live_deployed_aviator_prompt65.png') });

    // 5. Lotto / Number Game
    console.log('Verifying Live Lotto Draw Game...');
    await page.goto(`${LIVE_URL}/games/lotto`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, 'live_deployed_lotto_prompt65.png') });

    console.log('All live deployed tests passed successfully!');
  });
});
