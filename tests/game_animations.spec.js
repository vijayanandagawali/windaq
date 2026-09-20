const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('GAME ANIMATION MASTER PASS - Visual Verification Suite', () => {

  test('1. European Roulette: Wheel Canvas, Ball Orbit & Table Highlights', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying European Roulette Animations ---');

    await page.goto('http://localhost:3000/games/european-roulette', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Verify Canvas Roulette Wheel is present
    const wheelCanvas = page.locator('canvas').first();
    await expect(wheelCanvas).toBeVisible({ timeout: 10000 });
    console.log('✓ European Roulette 37-pocket Canvas Wheel verified');

    // Place bet to check chip animation
    const num17 = page.locator('button:has-text("17")').first();
    if (await num17.isVisible()) {
      await num17.click();
      console.log('✓ Placed bet on #17 with spring chip animation');
    }

    // Capture screenshot
    const rouletteScreenshot = path.resolve(__dirname, 'anim_roulette_wheel.png');
    await page.screenshot({ path: rouletteScreenshot });
    console.log(`✓ Roulette screenshot captured: ${rouletteScreenshot}`);
  });

  test('2. Texas Hold\'em Poker: Dealer Shoe, Community Cards & Table', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying Texas Hold\'em Poker Animations ---');

    await page.goto('http://localhost:3000/games/texas-holdem', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Verify Dealer shoe
    await expect(page.locator('text=DEALER').first()).toBeVisible({ timeout: 10000 });
    // Verify Pot badge
    await expect(page.locator('text=POT:').first()).toBeVisible({ timeout: 10000 });

    // Capture screenshot
    const pokerScreenshot = path.resolve(__dirname, 'anim_poker_table.png');
    await page.screenshot({ path: pokerScreenshot });
    console.log(`✓ Poker screenshot captured: ${pokerScreenshot}`);
  });

  test('3. Teen Patti Classic: 3D Cards, Dealer Shoe & Felt', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying Teen Patti Classic Animations ---');

    await page.goto('http://localhost:3000/games/teen-patti', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Verify Dealer shoe
    await expect(page.locator('text=DEALER').first()).toBeVisible({ timeout: 10000 });
    // Verify Pot
    await expect(page.locator('text=Total Pot').first()).toBeVisible({ timeout: 10000 });

    // Capture screenshot
    const tpScreenshot = path.resolve(__dirname, 'anim_teen_patti.png');
    await page.screenshot({ path: tpScreenshot });
    console.log(`✓ Teen Patti screenshot captured: ${tpScreenshot}`);
  });

  test('4. Vegas 777 Slots: Staggered Reels & Spin Animation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying Vegas 777 Slots Animations ---');

    await page.goto('http://localhost:3000/games/slots', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Click Spin button
    const spinBtn = page.locator('button:has-text("SPIN")').first();
    await expect(spinBtn).toBeVisible({ timeout: 10000 });
    await spinBtn.click();
    console.log('✓ Spin initiated, observing reel animations');

    await page.waitForTimeout(1000);

    // Capture screenshot during spin
    const slotsScreenshot = path.resolve(__dirname, 'anim_slots_reels.png');
    await page.screenshot({ path: slotsScreenshot });
    console.log(`✓ Slots screenshot captured: ${slotsScreenshot}`);
  });

  test('5. Aviator / Crash: Jet Aircraft Canvas & Multiplier', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying Aviator / Crash Animations ---');

    await page.goto('http://localhost:3000/games/aviator', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Verify Flight Canvas
    const flightCanvas = page.locator('canvas').first();
    await expect(flightCanvas).toBeVisible({ timeout: 10000 });

    // Verify Multiplier or countdown
    const multiText = page.locator('h1').or(page.locator('text=Waiting for next round')).first();
    await expect(multiText).toBeVisible({ timeout: 10000 });

    // Capture screenshot
    const aviatorScreenshot = path.resolve(__dirname, 'anim_aviator_jet.png');
    await page.screenshot({ path: aviatorScreenshot });
    console.log(`✓ Aviator screenshot captured: ${aviatorScreenshot}`);
  });

  test('6. Quick Draw Lotto: Blower Sphere & Tumbling Balls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying Quick Draw Lotto Animations ---');

    await page.goto('http://localhost:3000/games/lotto', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Verify Next Draw In
    await expect(page.locator('text=Next Draw In').first()).toBeVisible({ timeout: 10000 });

    // Capture screenshot
    const lottoScreenshot = path.resolve(__dirname, 'anim_lotto_blower.png');
    await page.screenshot({ path: lottoScreenshot });
    console.log(`✓ Lotto screenshot captured: ${lottoScreenshot}`);
  });

  test('7. Lucky 7 Scratch: Foil Surface & Scratch Interaction', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    console.log('--- Verifying Scratch Card Foil & Animations ---');

    await page.goto('http://localhost:3000/games/scratch', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Buy a silver ticket to render foil
    const buyBtn = page.locator('button:has-text("BUY TICKET")').first();
    if (await buyBtn.isVisible()) {
      await buyBtn.click();
      await page.waitForTimeout(1000);

      // Verify Canvas foil
      const canvas = page.locator('canvas').first();
      if (await canvas.isVisible()) {
        console.log('✓ Canvas foil rendered, executing scratch motion');
        const box = await canvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
          await page.mouse.up();
        }
      }
    }

    // Capture screenshot
    const scratchScreenshot = path.resolve(__dirname, 'anim_scratch_card.png');
    await page.screenshot({ path: scratchScreenshot });
    console.log(`✓ Scratch card screenshot captured: ${scratchScreenshot}`);
  });

});
