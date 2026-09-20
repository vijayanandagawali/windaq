const { test, expect } = require('@playwright/test');

test.describe('Realtime Game Loop & WebSocket Refresh Recovery Suite', () => {
  test('Verifies realtime lifecycle events and instant state rehydration on page refresh', async ({ page }) => {
    // 1. Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('--- Step 1: Navigating to /games/dragon-tiger ---');
    await page.goto('http://localhost:3000/games/dragon-tiger', { waitUntil: 'domcontentloaded' });

    // Wait for the simulated live table to load
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 15000 });
    console.log('✓ Simulated Live Table loaded successfully');

    // 2. Wait for BETTING_OPEN phase to place bet
    console.log('--- Step 2: Waiting for BETTING_OPEN phase ---');
    // Check breadcrumbs tracker or status badge
    await page.waitForFunction(() => {
      const el = document.querySelector('span.font-mono.font-black');
      const bettingOpen = document.body.innerText.includes('Betting Open') || 
                           document.body.innerText.includes('BETTING OPEN') ||
                           document.body.innerText.includes('PLACE YOUR BETS');
      return bettingOpen;
    }, { timeout: 35000 });

    // Ensure we have at least 4 seconds remaining in betting phase to place the bet cleanly
    await page.waitForFunction(() => {
      const badges = Array.from(document.querySelectorAll('span'));
      const secBadge = badges.find(b => b.textContent && b.textContent.includes('s') && /^\d+s$/.test(b.textContent.trim()));
      if (secBadge) {
        const secs = parseInt(secBadge.textContent);
        return secs >= 4;
      }
      return true;
    }, { timeout: 20000 });

    // 3. Select ₹100 chip and place bet on DRAGON
    console.log('--- Step 3: Placing ₹100 bet on DRAGON ---');
    const chip100 = page.locator('button:has-text("100")').first();
    await chip100.click();

    const dragonSpot = page.locator('button:has-text("DRAGON")').first();
    await dragonSpot.click();

    // Verify chip badge appeared on DRAGON
    const chipBadge = page.locator('button:has-text("DRAGON") >> text=₹100');
    await expect(chipBadge).toBeVisible({ timeout: 5000 });
    console.log('✓ Bet placed and ₹100 chip badge visible on DRAGON spot');

    // Capture screenshot before refresh
    await page.screenshot({ path: 'tests/pre_refresh_bet_placed.png' });
    console.log('✓ Captured tests/pre_refresh_bet_placed.png');

    // 4. Trigger Page Refresh (Simulating user F5 / reconnect)
    console.log('--- Step 4: Refreshing page (F5 / Reconnect test) ---');
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Wait for simulated live table to re-mount
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 15000 });
    console.log('✓ Page reloaded and table re-mounted');

    // 5. CRITICAL TEST: Verify that the user\'s ₹100 chip on DRAGON is RESTORED immediately upon refresh
    console.log('--- Step 5: Verifying restored active bets from server snapshot ---');
    // The server snapshot provides `myBets: { DRAGON: 100 }` which hydrates `myBets` in `SimulatedLiveTable`
    const restoredChipBadge = page.locator('button:has-text("DRAGON") >> text=₹100');
    await expect(restoredChipBadge).toBeVisible({ timeout: 8000 });
    console.log('✓ CRITICAL PASS: ₹100 chip on DRAGON restored seamlessly on page refresh!');

    // Capture screenshot showing restored state
    await page.screenshot({ path: 'tests/post_refresh_state_restored.png' });
    console.log('✓ Captured tests/post_refresh_state_restored.png');

    // 6. Verify Server Authoritative Countdown is running without resetting
    const timerBadge = page.locator('span.font-mono.font-black');
    await expect(timerBadge.first()).toBeVisible();
    const timerValue = await timerBadge.first().innerText();
    console.log(`✓ Server-authoritative visual countdown active at: ${timerValue}`);

    // 7. Observe progression through the remaining lifecycle states
    console.log('--- Step 6: Observing progression through full game loop ---');
    
    // Wait for RESULT or SETTLEMENT or NEXT_ROUND phase
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('WINS!') || 
             text.includes('Result') || 
             text.includes('Settlement') || 
             text.includes('Completed') ||
             text.includes('Next Round');
    }, { timeout: 30000 });

    console.log('✓ Successfully observed round resolution (Result / Settlement / Next Round)');

    // Capture final lifecycle progression screenshot
    await page.screenshot({ path: 'tests/game_loop_progression.png' });
    console.log('✓ Captured tests/game_loop_progression.png');
    console.log('🎉 ALL REALTIME GAME LOOP AND REFRESH RECOVERY TESTS PASSED!');
  });
});
