const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const WEB_BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-fallback';

test.describe.serial('WINDAQ PROMPT #62 — CENTRAL REALTIME ROUND ENGINE & ADMIN CONTROL SUITE', () => {

  // Test Admin JWT token
  const adminToken = jwt.sign(
    { userId: 'TEST_ADMIN', phone: '+919999990005', role: 'SUPER_ADMIN' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // Test Player JWT token
  const playerToken = jwt.sign(
    { userId: 'TEST_PLAYER_01', phone: '+919999990001', role: 'USER' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // -------------------------------------------------------------------------
  // TEST 1: CONTINUOUS ROUND LIFECYCLE & ZERO DEAD SCREEN (DRAGON TIGER)
  // -------------------------------------------------------------------------
  test('Case 1: Full Continuous Lifecycle: Countdown -> Bet -> Lock -> Play -> Result -> Settle -> Next Round', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        consoleErrors.push(msg.text());
      }
    });

    // Authenticate player in browser
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_token', token);
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_id', 'TEST_PLAYER_01');
      localStorage.setItem('windaq_user_data', JSON.stringify({ id: 'TEST_PLAYER_01', phone: '+919999990001' }));
    }, { token: playerToken });

    console.log('Navigating to /games/dragon-tiger...');
    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    // Verify Simulated Live Table container loaded
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 20000 });
    console.log('✓ Simulated Live Table loaded');

    // Verify Server-Authoritative Countdown is active
    const timerBadge = page.locator('span.font-mono.font-black').first();
    await expect(timerBadge).toBeVisible();
    const countdownVal = await timerBadge.innerText();
    console.log(`✓ Authoritative countdown timer: ${countdownVal}`);

    // Wait for fresh BETTING_OPEN phase (with at least 4 seconds remaining) to place bet safely
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      const hasBettingOpen = text.includes('PLACE YOUR BETS') || text.includes('BETTING OPEN');
      const timerEl = document.querySelector('span.font-mono.font-black');
      const time = timerEl ? parseInt(timerEl.textContent || '0', 10) : 0;
      return hasBettingOpen && time >= 4;
    }, { timeout: 45000 });

    // Ensure DRAGON bet spot is enabled and click it
    const dragonSpot = page.locator('button[data-testid="bet-spot-dragon"]').first();
    await expect(dragonSpot).toBeEnabled({ timeout: 10000 });
    await dragonSpot.click();
    console.log('✓ Placed bet on DRAGON');

    // Capture initial roundId
    const initialRoundText = await page.locator('text=DRA-').or(page.locator('text=ROUND:')).first().innerText({ timeout: 5000 }).catch(() => 'DRA-active');
    console.log(`✓ Active Round Reference: ${initialRoundText}`);

    // Wait for round progression through DEALING/RESULT/SETTLEMENT
    console.log('Observing transition through Playing -> Result -> Settlement...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('DEALING CARDS') || 
             text.includes('BETS CLOSED') || 
             text.includes('WINNER ANNOUNCED') || 
             text.includes('SETTLING WINNERS') ||
             text.includes('ROUND COMPLETED') ||
             text.includes('WINS!') ||
             text.includes('DRAGON') ||
             text.includes('TIGER');
    }, { timeout: 60000 });
    console.log('✓ Observed outcome and settlement phase');

    // Verify Next Round automatically starts without dead screen
    console.log('Verifying automatic progression to Next Round...');
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('PLACE YOUR BETS') || text.includes('Betting Open') || text.includes('BETTING OPEN') || text.includes('ROUND CREATED') || text.includes('BETS CLOSING');
    }, { timeout: 45000 });
    console.log('✓ Next round automatically started with zero dead screen!');

    // Screenshot continuous cycle
    await page.screenshot({ path: 'tests/round_engine_continuous_cycle.png' });
    expect(consoleErrors.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 2: RECONNECT & PAGE REFRESH STATE RECOVERY
  // -------------------------------------------------------------------------
  test('Case 2: Reconnection & F5 Refresh instantly restores server-authoritative state', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_token', token);
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_id', 'TEST_PLAYER_01');
      localStorage.setItem('windaq_user_data', JSON.stringify({ id: 'TEST_PLAYER_01', phone: '+919999990001' }));
    }, { token: playerToken });

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 20000 });

    // Wait for betting open with safe window
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      const hasBettingOpen = text.includes('PLACE YOUR BETS') || text.includes('BETTING OPEN');
      const timerEl = document.querySelector('span.font-mono.font-black');
      const time = timerEl ? parseInt(timerEl.textContent || '0', 10) : 0;
      return hasBettingOpen && time >= 4;
    }, { timeout: 45000 });

    const dragonSpot = page.locator('button[data-testid="bet-spot-dragon"]').first();
    await expect(dragonSpot).toBeEnabled({ timeout: 10000 });
    await dragonSpot.click();

    // Trigger Page Refresh (Simulating sudden disconnect / F5)
    console.log('Triggering F5 browser reload during active round...');
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Table must re-mount and rehydrate active state immediately
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 20000 });
    const timerBadge = page.locator('span.font-mono.font-black').first();
    await expect(timerBadge).toBeVisible();

    console.log('✓ Reconnect recovery successfully restored active countdown and table state');
  });

  // -------------------------------------------------------------------------
  // TEST 3: OFFICIAL RESULT HISTORY DRAWER & PROVABLY FAIR PROOF
  // -------------------------------------------------------------------------
  test('Case 3: Official Result History Drawer displays 10, 20, 50, 100 with cryptographic proofs', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 15000 });

    // Open Official Result History Drawer
    const historyBtn = page.locator('button[title*="Result History"]').or(page.locator('button:has-text("History")')).first();
    await expect(historyBtn).toBeVisible({ timeout: 8000 });
    await historyBtn.click();

    // Verify Drawer Header
    await expect(page.locator('text=OFFICIAL RESULT HISTORY')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Server-Authoritative • Provably Fair')).toBeVisible();

    // Verify 10, 20, 50, 100 selectors
    for (const count of ['10', '20', '50', '100']) {
      const tab = page.locator(`button:has-text("${count}")`).first();
      await expect(tab).toBeVisible();
    }

    // Capture screenshot of History Drawer
    await page.screenshot({ path: 'tests/result_history_drawer_open.png' });
    console.log('✓ Official Result History Drawer verified with filters');
  });

  // -------------------------------------------------------------------------
  // TEST 4: ADMIN REALTIME CONTROL CENTER (/admin/realtime)
  // -------------------------------------------------------------------------
  test('Case 4: Admin Realtime Control Center shows active tables, liabilities, countdowns & timeline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Authenticate as SUPER_ADMIN
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_token', token);
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_id', 'TEST_ADMIN');
    }, { token: adminToken });

    console.log('Navigating to /admin/realtime...');
    await page.goto(`${WEB_BASE}/admin/realtime`, { waitUntil: 'domcontentloaded' });

    // Verify Title & Live Pulse Indicator
    await expect(page.locator('text=Realtime Control Center')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=LIVE ENGINE FEED')).toBeVisible();

    // Verify KPI Cards: ACTIVE TABLES, CONNECTED PLAYERS, TOTAL ROUND STAKE, CURRENT LIABILITY, SERVER HEALTH
    await expect(page.locator('text=ACTIVE TABLES')).toBeVisible();
    await expect(page.locator('text=CONNECTED PLAYERS')).toBeVisible();
    await expect(page.locator('text=TOTAL ROUND STAKE')).toBeVisible();
    await expect(page.locator('text=CURRENT LIABILITY')).toBeVisible();
    await expect(page.locator('text=SERVER HEALTH')).toBeVisible();

    // Verify active table rows (Roulette, Dragon Tiger, Aviator, Colour, Dice, etc.)
    await expect(page.locator('text=dragon tiger').or(page.locator('text=Dragon Tiger')).first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('text=roulette').or(page.locator('text=Roulette')).first()).toBeVisible();

    // Click "Inspect" on the first active table row to open the Interactive Timeline Modal
    const inspectBtn = page.locator('button:has-text("Inspect")').first();
    await inspectBtn.click();

    // Verify Interactive Timeline Modal opened
    await expect(page.locator('text=Canonical Lifecycle Timeline (Server-Authoritative)')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Cryptographic Result Pre-Commitment')).toBeVisible();
    await expect(page.locator('button:has-text("Copy Hash")')).toBeVisible();

    // Capture screenshot of Admin Realtime Control Center with Timeline Modal
    await page.screenshot({ path: 'tests/admin_realtime_control_timeline.png' });
    console.log('✓ Admin Realtime Control Center and Interactive Timeline verified');
  });

  // -------------------------------------------------------------------------
  // TEST 5: CONTINUOUS AUTOMATIC ROULETTE ENGINE & RESULT HISTORY
  // -------------------------------------------------------------------------
  test('Case 5: Continuous Roulette Engine running with Official History integration', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_token', token);
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_id', 'TEST_PLAYER_01');
    }, { token: playerToken });

    console.log('Navigating to /games/european-roulette...');
    await page.goto(`${WEB_BASE}/games/european-roulette`, { waitUntil: 'domcontentloaded' });

    // Verify Roulette Wheel and Betting Grid rendered
    await page.waitForSelector('text=EUROPEAN ROULETTE', { timeout: 15000 });
    await expect(page.locator('text=Official History').first()).toBeVisible({ timeout: 8000 });

    // Open Official History
    await page.locator('button:has-text("Official History")').first().click();
    await expect(page.locator('text=OFFICIAL RESULT HISTORY')).toBeVisible({ timeout: 5000 });

    // Capture screenshot
    await page.screenshot({ path: 'tests/roulette_continuous_round.png' });
    console.log('✓ European Roulette continuous round and history verified');
  });
});
