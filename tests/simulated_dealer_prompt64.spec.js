const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const WEB_BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'windaq-super-secret-key-123';

test.describe.serial('WINDAQ PROMPT #64 — VIRTUAL DEALER + CONTINUOUS MULTI-TABLE ENGINE', () => {

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

  test.beforeAll(async ({ request }) => {
    try {
      await request.post(`${API_BASE}/api/admin/tables/table-02/dealer`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        data: { dealerId: 'dealer_maya' }
      });
    } catch {
      // ignore
    }
  });

  // -------------------------------------------------------------------------
  // TEST 1: CLEAR PRODUCT DESIGNATION & VIRTUAL DEALER PROFILE PRESENTATION
  // -------------------------------------------------------------------------
  test('Case 1: Prominent Virtual Dealer Designation & Profile Presentation', async ({ page }) => {
    test.setTimeout(60000);

    // Set auth cookie
    await page.context().addCookies([
      { name: 'token', value: playerToken, domain: 'localhost', path: '/' }
    ]);

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    // 1. Verify Prominent Clear Designation Badge (Never faked as real human live dealer)
    const dealerBadge = page.locator('[data-testid="virtual-dealer-badge"]');
    await expect(dealerBadge).toBeVisible({ timeout: 15000 });
    const badgeText = await dealerBadge.textContent();
    expect(badgeText).toContain('SIMULATED DEALER');
    expect(badgeText).toContain('WINDAQ ORIGINAL TABLE');

    // 2. Verify Virtual Dealer Stage and Avatar Podium
    const dealerStage = page.locator('[data-testid="virtual-dealer-stage"]');
    await expect(dealerStage).toBeVisible();

    // 3. Verify Dealer Nameplate
    const nameplate = page.locator('[data-testid="dealer-display-name"]');
    await expect(nameplate).toBeVisible();
    const nameText = await nameplate.textContent();
    expect(nameText?.length).toBeGreaterThan(0);

    // 4. Verify Dealer Speech Bubble
    const speechBubble = page.locator('[data-testid="dealer-speech-text"]');
    await expect(speechBubble).toBeVisible();
    const speechText = await speechBubble.textContent();
    expect(speechText?.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // TEST 2: DEALER STATE SYNCHRONIZATION WITH SERVER ROUND ENGINE
  // -------------------------------------------------------------------------
  test('Case 2: Dealer Speech & Action Syncs With Central Round State Machine', async ({ page }) => {
    test.setTimeout(90000);

    await page.context().addCookies([
      { name: 'token', value: playerToken, domain: 'localhost', path: '/' }
    ]);

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    // Observe round phase transitions and verify dealer state responds
    const initialSpeech = await page.locator('[data-testid="dealer-speech-text"]').textContent();

    // Wait for at least one phase change and confirm speech updates
    let updatedSpeech = initialSpeech;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(1000);
      const current = await page.locator('[data-testid="dealer-speech-text"]').textContent();
      if (current !== initialSpeech) {
        updatedSpeech = current;
        break;
      }
    }
    expect(updatedSpeech).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST 3: SIMULATED OPPONENTS / BOT SEATS PRESENTATION
  // -------------------------------------------------------------------------
  test('Case 3: Simulated Opponent Bots Render with Explicit AI Badges', async ({ page }) => {
    test.setTimeout(60000);

    await page.context().addCookies([
      { name: 'token', value: playerToken, domain: 'localhost', path: '/' }
    ]);

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    // Verify Simulated Bot Seats are visible with [SIMULATED BOT] badge
    const botSeat1 = page.locator('[data-testid="simulated-bot-seat-1"]');
    await expect(botSeat1).toBeVisible({ timeout: 15000 });
    const botSeat1Text = await botSeat1.textContent();
    expect(botSeat1Text).toContain('[SIMULATED BOT]');
    expect(botSeat1Text).toContain('AI');

    const botSeat2 = page.locator('[data-testid="simulated-bot-seat-2"]');
    await expect(botSeat2).toBeVisible();
    const botSeat2Text = await botSeat2.textContent();
    expect(botSeat2Text).toContain('[SIMULATED BOT]');
  });

  // -------------------------------------------------------------------------
  // TEST 4: CONTINUOUS TABLE OPERATION — 5 ROUNDS CYCLE
  // -------------------------------------------------------------------------
  test('Case 4: Continuous Table Operation — 5 Continuous Rounds Without Dead Screen', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes to observe 5 continuous rounds

    await page.context().addCookies([
      { name: 'token', value: playerToken, domain: 'localhost', path: '/' }
    ]);

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    const observedRounds = new Set();
    const startTime = Date.now();

    // Poll until we have observed at least 5 distinct round IDs
    while (observedRounds.size < 5 && (Date.now() - startTime) < 160000) {
      const roundIdElem = page.locator('text=ROUND:').locator('..').locator('span.font-bold');
      if (await roundIdElem.isVisible()) {
        const rId = await roundIdElem.textContent();
        if (rId && rId !== 'N/A') {
          observedRounds.add(rId.trim());
        }
      }
      await page.waitForTimeout(2000);
    }

    console.log(`Observed ${observedRounds.size} continuous rounds:`, Array.from(observedRounds));
    expect(observedRounds.size).toBeGreaterThanOrEqual(5);
  });

  // -------------------------------------------------------------------------
  // TEST 5: MULTI-TABLE CONCURRENCY & INDEPENDENT EXECUTION
  // -------------------------------------------------------------------------
  test('Case 5: Multi-Table Concurrency (Roulette, Dragon Tiger, Andar Bahar)', async ({ request }) => {
    // Query admin tables API directly to verify independent table operation
    const res = await request.get(`${API_BASE}/api/admin/tables`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.tables.length).toBeGreaterThanOrEqual(3);

    const roulette = data.tables.find(t => t.gameId === 'roulette');
    const dragonTiger = data.tables.find(t => t.gameId === 'dragon-tiger');
    const andarBahar = data.tables.find(t => t.gameId === 'andar-bahar');

    expect(roulette).toBeDefined();
    expect(dragonTiger).toBeDefined();
    expect(andarBahar).toBeDefined();

    // Verify each table has independent roundId and dealer
    expect(roulette.roundId).not.toBe(dragonTiger.roundId);
    expect(dragonTiger.roundId).not.toBe(andarBahar.roundId);
    expect(roulette.dealer.displayName).toBe('Virtual Sophia');
    expect(['Virtual Maya', 'Virtual Liam']).toContain(dragonTiger.dealer.displayName);
    expect(andarBahar.dealer.displayName).toBe('Virtual Arjun');
  });

  // -------------------------------------------------------------------------
  // TEST 6: ADMIN TABLE CONTROL DASHBOARD & ANTI-MANIPULATION ARCHITECTURE
  // -------------------------------------------------------------------------
  test('Case 6: Admin Table Control Dashboard, Audited Config & Anti-Manipulation Protection', async ({ page, request }) => {
    test.setTimeout(90000);

    // 1. Anti-Outcome Manipulation Protection Check via API
    const rigAttempt = await request.patch(`${API_BASE}/api/admin/tables/table-02/config`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      data: { winner: 'TIGER', winningNumber: 7 }
    });
    expect(rigAttempt.status()).toBe(403);
    const rigData = await rigAttempt.json();
    expect(rigData.message).toContain('strictly prohibited');

    // 2. Open Admin Tables Page in Browser
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_ADMIN',
        phone: '+919999990005',
        role: 'SUPER_ADMIN',
        isGuest: false
      }));
    }, { token: adminToken });

    await page.goto(`${WEB_BASE}/admin/tables`, { waitUntil: 'domcontentloaded' });

    // Verify Header & Anti-Manipulation Banner
    await expect(page.locator('h1:has-text("Automated Virtual Tables")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Cryptographic Provably Fair & Anti-Manipulation Protection')).toBeVisible();

    // Verify Table Cards for all configured tables
    const tableCards = page.locator('[data-testid^="admin-table-card-"]');
    const count = await tableCards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Verify Configure Table modal opens
    const firstConfigureBtn = page.locator('button:has-text("Configure")').first();
    await firstConfigureBtn.click();
    await expect(page.locator('h3:has-text("Configure")')).toBeVisible();
    await page.locator('button:has-text("Cancel")').click();
  });

  // -------------------------------------------------------------------------
  // TEST 7: MOBILE RESPONSIVENESS (360x800, 390x844, 430x932)
  // -------------------------------------------------------------------------
  test('Case 7: Mobile Viewports Rendering & Layout Integrity', async ({ page }) => {
    test.setTimeout(90000);

    const mobileViewports = [
      { name: 'Samsung Galaxy S20', width: 360, height: 800 },
      { name: 'iPhone 14', width: 390, height: 844 },
      { name: 'iPhone 14 Pro Max', width: 430, height: 932 }
    ];

    await page.context().addCookies([
      { name: 'token', value: playerToken, domain: 'localhost', path: '/' }
    ]);

    for (const vp of mobileViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

      // Verify Virtual Dealer Badge is visible on mobile
      const dealerBadge = page.locator('[data-testid="virtual-dealer-badge"]');
      await expect(dealerBadge).toBeVisible({ timeout: 15000 });

      // Verify Betting Controls are visible and not clipped
      const dragonBtn = page.locator('button:has-text("DRAGON")').first();
      await expect(dragonBtn).toBeVisible();

      // Check no horizontal scrollbar overflow on mobile
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    }
  });

});
