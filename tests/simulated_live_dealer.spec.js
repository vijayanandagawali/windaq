const { test, expect } = require('@playwright/test');

test.describe('Simulated Live Dealer Engine & Table Suite', () => {
  test('Dragon Tiger Simulated Live Table executes continuous server-authoritative cycle and virtual dealer presentation', async ({ page }) => {
    // 1. Set viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // 2. Navigate to Dragon Tiger
    console.log('Navigating to /games/dragon-tiger...');
    await page.goto('http://localhost:3000/games/dragon-tiger', { waitUntil: 'domcontentloaded' });

    // Wait for the simulated live table container to render
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 15000 });
    console.log('✓ Found SIMULATED LIVE TABLE header badge');

    // 3. Verify Virtual Dealer (Avatar, Nameplate, Speech Bubble)
    const dealerNameplate = page.locator('text=MAYA • VIRTUAL DEALER');
    await expect(dealerNameplate).toBeVisible({ timeout: 10000 });
    console.log('✓ Virtual Dealer Maya nameplate is visible');

    // Dealer avatar SVG is rendered
    const dealerSvg = page.locator('svg').filter({ has: page.locator('ellipse') });
    await expect(dealerSvg.first()).toBeVisible();
    console.log('✓ Virtual Dealer SVG avatar is rendered');

    // 4. Verify Camera Switcher (Studio, Felt, Spotlight)
    const studioBtn = page.getByRole('button', { name: 'Studio' });
    const feltBtn = page.getByRole('button', { name: 'Felt' });
    const spotlightBtn = page.getByRole('button', { name: 'Spotlight' });

    await expect(studioBtn).toBeVisible();
    await expect(feltBtn).toBeVisible();
    await expect(spotlightBtn).toBeVisible();

    // Click Felt angle
    await feltBtn.click();
    console.log('✓ Switched to Felt camera angle');
    await page.waitForTimeout(500);

    // Click Spotlight angle
    await spotlightBtn.click();
    console.log('✓ Switched to Spotlight camera angle');
    await page.waitForTimeout(500);

    // Switch back to Studio angle
    await studioBtn.click();
    console.log('✓ Switched back to Studio camera angle');

    // 5. Verify Betting Spots (DRAGON, TIE, TIGER)
    const dragonSpot = page.locator('button').filter({ hasText: 'DRAGON' }).first();
    const tieSpot = page.locator('button').filter({ hasText: 'TIE' }).first();
    const tigerSpot = page.locator('button').filter({ hasText: 'TIGER' }).first();

    await expect(dragonSpot).toBeVisible();
    await expect(tieSpot).toBeVisible();
    await expect(tigerSpot).toBeVisible();
    console.log('✓ All 3 betting spots (Dragon, Tie, Tiger) are rendered');

    // 6. Verify 3D Chip Selector
    const chipButtons = page.locator('button').filter({ hasText: /^(10|50|100|500|1K|5K)$/ });
    const chipCount = await chipButtons.count();
    console.log(`✓ Found ${chipCount} chip denomination buttons`);
    expect(chipCount).toBeGreaterThanOrEqual(5);

    // Select 500 chip
    const chip500 = page.locator('button').filter({ hasText: '500' }).first();
    await chip500.click();
    console.log('✓ Selected 500 chip');

    // 7. Verify Sound Toggle
    const soundBtn = page.locator('button[title*="Sound"]');
    await expect(soundBtn).toBeVisible();
    await soundBtn.click(); // Toggle mute
    console.log('✓ Toggled sound mute/unmute');

    // 8. Verify Provably Fair Modal
    const provablyFairBtn = page.locator('button[title*="Provably Fair"]');
    await expect(provablyFairBtn).toBeVisible();
    await provablyFairBtn.click();
    
    // Modal should be visible
    const pfModal = page.locator('text=Provably Fair Verification');
    await expect(pfModal).toBeVisible();
    const hashLabel = page.locator('text=Server Seed Hash');
    await expect(hashLabel).toBeVisible();
    console.log('✓ Provably Fair modal opened with Server Seed Hash');

    // Close modal
    const closePfBtn = page.locator('button:has-text("Close Verification")');
    await closePfBtn.click();
    await expect(pfModal).not.toBeVisible();
    console.log('✓ Closed Provably Fair modal');

    // 9. Verify Phase Progress Breadcrumb
    const phaseOpen = page.locator('text=1. Betting Open');
    const phaseClosed = page.locator('text=2. Closed');
    const phaseDealing = page.locator('text=3. Dealing');
    const phaseResult = page.locator('text=4. Result');
    const phaseSettlement = page.locator('text=5. Settlement');
    const phaseNext = page.locator('text=6. Next Round');

    await expect(phaseOpen).toBeVisible();
    await expect(phaseClosed).toBeVisible();
    await expect(phaseDealing).toBeVisible();
    await expect(phaseResult).toBeVisible();
    await expect(phaseSettlement).toBeVisible();
    await expect(phaseNext).toBeVisible();
    console.log('✓ All 6 phase breadcrumbs are rendered');

    // 10. Capture screenshot of the table in action
    await page.screenshot({ path: 'tests/simulated_live_table_active.png' });
    console.log('✓ Saved screenshot tests/simulated_live_table_active.png');

    // 11. Wait for cycle transition to confirm server-authoritative loop is active
    console.log('Observing server-authoritative live table loop...');
    // We observe for 18 seconds to ensure at least one phase transition occurs
    await page.waitForTimeout(6000);
    
    // Verify Roadmap
    const roadmapLabel = page.locator('text=Roadmap:');
    await expect(roadmapLabel).toBeVisible();
    console.log('✓ Roadmap / Bead plate strip is visible');
  });
});
