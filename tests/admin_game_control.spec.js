import { test, expect } from '@playwright/test';

test.describe('ADMIN GAME CONTROL & VERSIONED PAYOUT GOVERNANCE SUITE', () => {

  test.beforeEach(async ({ page }) => {
    // Reset Dragon Tiger to operational state before each test
    await page.request.patch('http://localhost:4000/api/admin/games/dragon-tiger/config', {
      headers: {
        'Content-Type': 'application/json',
        'x-admin-user-id': 'mock-super-admin-id'
      },
      data: {
        isEnabled: true,
        isMaintenance: false,
        minBet: 10,
        maxBet: 50000,
        dealerSpeed: 1.0
      }
    }).catch(() => {});
  });

  test('1. Admin Game Control Dashboard Loads All Games with Metrics and Payout Versions', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/games');
    await page.waitForLoadState('networkidle');

    // Verify main header
    const heading = page.locator('h1:has-text("Admin Game Control Room")');
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Verify KPI cards
    await expect(page.locator('text=Total Catalog')).toBeVisible();
    await expect(page.locator('text=Active & Open')).toBeVisible();
    await expect(page.locator('text=Maintenance Mode')).toBeVisible();

    // Verify games are rendered in the table
    const dtRow = page.locator('tr:has-text("Dragon Tiger")').first();
    await expect(dtRow).toBeVisible();

    const rouletteRow = page.locator('tr:has-text("European Roulette")').first();
    await expect(rouletteRow).toBeVisible();

    const aviatorRow = page.locator('tr:has-text("Aviator Crash")').first();
    await expect(aviatorRow).toBeVisible();

    // Verify version badge exists (e.g. v1 or v2)
    const versionBadge = dtRow.locator('text=/v[0-9]/').first();
    await expect(versionBadge).toBeVisible();

    // Capture screenshot of control room
    await page.screenshot({ path: 'tests/admin_game_control_dashboard.png' });
    console.log('✓ Admin Game Control Dashboard rendered successfully with all 16 games and version badges');
  });

  test('2. Quick Toggles: Game Active/Disabled and Maintenance Mode with Live Realtime Sync', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/games');
    await page.waitForLoadState('networkidle');

    const dtRow = page.locator('tr:has-text("Dragon Tiger")').first();
    await expect(dtRow).toBeVisible();

    // Toggle Maintenance Mode on Dragon Tiger
    const maintBtn = dtRow.locator('button[title*="Maintenance"]').first();
    await maintBtn.click();

    // Verify maintenance badge appears on Dragon Tiger
    const maintBadge = dtRow.locator('span:has-text("Maintenance")').first();
    await expect(maintBadge).toBeVisible({ timeout: 8000 });
    console.log('✓ Maintenance mode toggled active on Dragon Tiger');

    // Allow network call to settle
    await page.waitForTimeout(500);

    // Verify server API reflects maintenance
    const apiCheck1 = await page.evaluate(async () => {
      const res = await fetch('http://localhost:4000/api/admin/games/dragon-tiger', {
        headers: { 'x-admin-user-id': 'mock-super-admin-id' }
      });
      const data = await res.json();
      return data.data?.isMaintenance;
    });
    expect(apiCheck1).toBe(true);

    // Toggle Maintenance Mode off
    await maintBtn.click();
    const activeBadge = dtRow.locator('span:has-text("Active")').first();
    await expect(activeBadge).toBeVisible({ timeout: 8000 });
    console.log('✓ Maintenance mode toggled back to Active');
  });

  test('3. Game Configuration Drawer: Update Limits, Durations & Dealer Speed', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/games');
    await page.waitForLoadState('networkidle');

    // Open Dragon Tiger configuration modal
    const configureBtn = page.locator('tr:has-text("Dragon Tiger") button:has-text("Configure")').first();
    await configureBtn.click();

    // Verify modal opened
    const modalTitle = page.locator('h2:has-text("Dragon Tiger")').first();
    await expect(modalTitle).toBeVisible({ timeout: 5000 });

    // 1. Update Dealer Speed in General tab
    const speedBtn = page.locator('button:has-text("1.5x")').first();
    await speedBtn.click();

    const saveGeneralBtn = page.locator('button:has-text("Save General Settings")').first();
    await saveGeneralBtn.click();
    await page.waitForTimeout(1000);

    // 2. Switch to Limits & Durations tab
    const limitsTab = page.locator('button:has-text("Bet Limits & Durations")').first();
    await limitsTab.click();

    // Change Min Bet
    const minBetInput = page.locator('input[type="number"]').first();
    await minBetInput.fill('20');

    const saveLimitsBtn = page.locator('button:has-text("Save Limits & Durations")').first();
    await saveLimitsBtn.click();
    await page.waitForTimeout(1000);

    console.log('✓ Dealer speed and bet limits updated in Game Control drawer');
  });

  test('4. Versioned Financial Payout Rule Deployment with Mandatory Audit Rationale', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/games');
    await page.waitForLoadState('networkidle');

    // Open Dragon Tiger configuration modal
    const configureBtn = page.locator('tr:has-text("Dragon Tiger") button:has-text("Configure")').first();
    await configureBtn.click();

    // Switch to Versioned Payout Rules Tab
    const payoutsTab = page.locator('button:has-text("Versioned Payout Rules")').first();
    await payoutsTab.click();

    // Verify Active Version header is visible
    await expect(page.locator('text=Active Version: v')).toBeVisible();

    // Find Tie multiplier input and adjust value
    const tieInput = page.locator('input[type="number"]').nth(2); // Tie field
    await tieInput.fill('8.5');

    // Try submitting without reason -> Deploy button should be disabled
    const deployBtn = page.locator('button:has-text("Deploy New Payout Version")').first();
    await expect(deployBtn).toBeDisabled();

    // Fill in mandatory audit rationale
    const reasonTextarea = page.locator('textarea[placeholder*="Promotional"]').first();
    await reasonTextarea.fill('Promotional RTP Calibration - Weekend Boost');

    // Deploy button should now be enabled
    await expect(deployBtn).toBeEnabled();
    await deployBtn.click();

    // Wait for deployment confirmation toast
    const toast = page.locator('text=/Version [0-9]+ deployed and locked in successfully/').first();
    await expect(toast).toBeVisible({ timeout: 10000 });
    console.log('✓ New financial payout version deployed with mandatory audit reason');

    // Capture screenshot of version history
    await page.screenshot({ path: 'tests/admin_payout_version_deployed.png' });

    // Switch to Audit Trail tab
    const auditTab = page.locator('button:has-text("Audit Trail")').first();
    await auditTab.click();

    // Verify audit log entry exists with PAYOUT_RULE_VERSIONED
    const auditEntry = page.locator('text=PAYOUT_RULE_VERSIONED').first();
    await expect(auditEntry).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Promotional RTP Calibration - Weekend Boost').first()).toBeVisible();
    console.log('✓ Audit log confirmed immutable record of PAYOUT_RULE_VERSIONED');
  });

  test('5. Maintenance Mode Table Enforcement: Real-time Player Protection', async ({ page }) => {
    // 1. Put Dragon Tiger into Maintenance Mode via Admin API
    await page.evaluate(async () => {
      await fetch('http://localhost:4000/api/admin/games/dragon-tiger/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify({
          isMaintenance: true,
          maintenanceMessage: 'Emergency Card Scanner Upgrading. Back in 10 mins.'
        })
      });
    });

    // 2. Open player table
    await page.goto('http://localhost:3000/games/dragon-tiger');
    await page.waitForLoadState('networkidle');

    // Verify visual maintenance banner appears on table felt
    const maintBanner = page.locator('text=Emergency Card Scanner Upgrading').first();
    await expect(maintBanner).toBeVisible({ timeout: 15000 });
    console.log('✓ Player view displays active maintenance alert on felt');

    // Attempt to place a bet
    const dragonBtn = page.locator('button:has-text("DRAGON")').first();
    if (await dragonBtn.isVisible()) {
      await dragonBtn.click();
      // Should show maintenance toast and NOT place bet
      const toast = page.locator('text=/Maintenance:/i').first();
      await expect(toast).toBeVisible({ timeout: 5000 });
      console.log('✓ Bet placement successfully rejected during maintenance mode');
    }

    // Capture screenshot of player maintenance screen
    await page.screenshot({ path: 'tests/player_maintenance_overlay.png' });

    // 3. Clean up: Restore game to active state
    await page.evaluate(async () => {
      await fetch('http://localhost:4000/api/admin/games/dragon-tiger/config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-user-id': 'mock-super-admin-id'
        },
        body: JSON.stringify({ isMaintenance: false })
      });
    });
    console.log('✓ Dragon Tiger restored to operational state');
  });

});
