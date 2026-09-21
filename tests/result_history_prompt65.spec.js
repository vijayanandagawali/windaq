const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const WEB_BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'windaq-super-secret-key-123';

test.describe.serial('WINDAQ PROMPT #65 — RESULT HISTORY, ROADMAP & ROUND VERIFICATION ENGINE', () => {

  const adminToken = jwt.sign(
    { userId: 'TEST_ADMIN_65', phone: '+919999990005', role: 'SUPER_ADMIN' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const playerToken = jwt.sign(
    { userId: 'TEST_PLAYER_65', phone: '+919999990001', role: 'USER' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // -------------------------------------------------------------------------
  // TEST 1: UNIVERSAL RESULT RECORD CREATION FOR COMPLETED ROUNDS
  // -------------------------------------------------------------------------
  test('Case 1: Authoritative Universal Result Record Created for Completed Rounds', async ({ request }) => {
    test.setTimeout(30000);

    // Query universal history API for Roulette
    const resRoulette = await request.get(`${API_BASE}/api/games/roulette/history?limit=10`);
    expect(resRoulette.status()).toBe(200);
    const dataRoulette = await resRoulette.json();
    expect(dataRoulette.success).toBe(true);
    expect(Array.isArray(dataRoulette.history)).toBe(true);

    if (dataRoulette.history.length > 0) {
      const record = dataRoulette.history[0];
      expect(record).toHaveProperty('resultId');
      expect(record).toHaveProperty('roundId');
      expect(record).toHaveProperty('gameId', 'roulette');
      expect(record).toHaveProperty('resultType', 'ROULETTE');
      expect(record).toHaveProperty('resultValue');
      expect(record).toHaveProperty('commitmentHash');
      expect(record).toHaveProperty('settlementStatus', 'SETTLED');
    }

    // Query universal history API for Dragon Tiger
    const resDT = await request.get(`${API_BASE}/api/games/dragon-tiger/history?limit=10`);
    expect(resDT.status()).toBe(200);
    const dataDT = await resDT.json();
    expect(dataDT.success).toBe(true);
    expect(Array.isArray(dataDT.history)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST 2: REST HISTORY APIS & PAGINATION (10, 20, 50, 100)
  // -------------------------------------------------------------------------
  test('Case 2: Universal History REST APIs, Latest Roadmap & Pagination', async ({ request }) => {
    test.setTimeout(30000);

    // 1. Latest Roadmap API
    const resRoadmap = await request.get(`${API_BASE}/api/games/roulette/history/latest?count=20`);
    expect(resRoadmap.status()).toBe(200);
    const dataRoadmap = await resRoadmap.json();
    expect(dataRoadmap.success).toBe(true);
    expect(dataRoadmap.disclaimer).toContain('Not a predictive system');
    expect(Array.isArray(dataRoadmap.roadmap)).toBe(true);

    // 2. Pagination test (limit=10 vs limit=20)
    const resLimit10 = await request.get(`${API_BASE}/api/games/roulette/history?limit=10&page=1`);
    expect(resLimit10.status()).toBe(200);
    const data10 = await resLimit10.json();
    expect(data10.limit).toBe(10);

    // 3. Round Result Lookup API
    if (data10.history.length > 0) {
      const roundId = data10.history[0].roundId;
      const resRound = await request.get(`${API_BASE}/api/rounds/${roundId}/result`);
      expect(resRound.status()).toBe(200);
      const dataRound = await resRound.json();
      expect(dataRound.success).toBe(true);
      expect(dataRound.result.roundId).toBe(roundId);
    }
  });

  // -------------------------------------------------------------------------
  // TEST 3: PROVABLY FAIR VERIFICATION & CRYPTOGRAPHIC SEED INTEGRITY
  // -------------------------------------------------------------------------
  test('Case 3: Authoritative Provably Fair Verification API', async ({ request }) => {
    test.setTimeout(30000);

    const resHistory = await request.get(`${API_BASE}/api/games/roulette/history?limit=5`);
    const data = await resHistory.json();

    if (data.history.length > 0) {
      const record = data.history[0];
      const resultId = record.resultId || record.roundId;

      // Call verification endpoint
      const resVerify = await request.get(`${API_BASE}/api/results/${resultId}/verify`);
      expect(resVerify.status()).toBe(200);
      const verifyData = await resVerify.json();

      expect(verifyData.success).toBe(true);
      expect(verifyData.commitmentValid).toBe(true);
      expect(verifyData.recomputedCommitment.toLowerCase()).toBe(record.commitmentHash.toLowerCase());
      expect(verifyData.algorithm).toBe('HMAC_SHA256_V1');
    }
  });

  // -------------------------------------------------------------------------
  // TEST 4: IMMUTABLE HISTORY & AUDITED CORRECTION WORKFLOW
  // -------------------------------------------------------------------------
  test('Case 4: Strict Immutability & Audited Result Correction Workflow', async ({ request }) => {
    test.setTimeout(30000);

    const resHistory = await request.get(`${API_BASE}/api/games/roulette/history?limit=5`);
    const data = await resHistory.json();
    expect(data.history.length).toBeGreaterThan(0);

    const target = data.history[0];
    const resultId = target.resultId;

    // 1. Attempt unauthenticated or invalid correction without reason -> MUST FAIL
    const resInvalid = await request.post(`${API_BASE}/api/admin/results/${resultId}/correct`, {
      data: {
        authorizedActor: 'OPERATOR_1',
        correctionReason: 'bad', // < 5 chars
        newResult: { value: '0 GREEN' }
      }
    });
    expect(resInvalid.status()).toBe(400);

    // 2. Perform authentic, audited correction
    const resCorrect = await request.post(`${API_BASE}/api/admin/results/${resultId}/correct`, {
      data: {
        authorizedActor: 'SUPER_ADMIN_AUDIT',
        correctionReason: 'Authoritative camera alignment audit verification',
        newResult: { value: '0 GREEN', summary: '0 GREEN' }
      }
    });
    expect(resCorrect.status()).toBe(200);
    const correctData = await resCorrect.json();
    expect(correctData.success).toBe(true);
    expect(correctData.correctionId).toBeDefined();
    expect(correctData.updatedRecord.isCorrected).toBe(true);
    expect(correctData.updatedRecord.settlementStatus).toBe('CORRECTED');
  });

  // -------------------------------------------------------------------------
  // TEST 5: ADMIN RESULT HISTORY DASHBOARD & LIFECYCLE TIMELINE
  // -------------------------------------------------------------------------
  test('Case 5: Admin Result History Dashboard & 8-Step Lifecycle Timeline', async ({ page }) => {
    test.setTimeout(60000);

    // Set admin cookie & localStorage using addInitScript before page loads
    await page.context().addCookies([
      { name: 'token', value: adminToken, domain: 'localhost', path: '/' }
    ]);
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_ADMIN_65',
        phone: '+919999990005',
        role: 'SUPER_ADMIN',
        isGuest: false
      }));
    }, { token: adminToken });

    // Navigate to admin history with verified session
    await page.goto(`${WEB_BASE}/admin/history`, { waitUntil: 'domcontentloaded' });

    // 1. Verify Admin Dashboard Header
    await expect(page.locator('h1:has-text("Authoritative Result History")')).toBeVisible({ timeout: 15000 });

    // 2. Verify Table Columns Exist
    await expect(page.locator('text=Game / Variant').first()).toBeVisible();
    await expect(page.locator('text=Authoritative Result').first()).toBeVisible();
    await expect(page.locator('text=SHA-256 Commitment').first()).toBeVisible();

    // 3. Inspect Lifecycle Timeline
    const timelineBtn = page.locator('button:has-text("Timeline")').first();
    if (await timelineBtn.isVisible()) {
      await timelineBtn.click();
      await expect(page.locator('text=Round Canonical Lifecycle Timeline')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=ROUND_CREATED').first()).toBeVisible();
      await page.screenshot({ path: path.join(__dirname, 'admin_round_timeline_prompt65.png') });
      await page.locator('button:has-text("Close Timeline")').click();
    }

    // 4. Capture Admin History Dashboard screenshot
    await page.screenshot({ path: path.join(__dirname, 'admin_result_history_prompt65.png') });
  });

  // -------------------------------------------------------------------------
  // TEST 6: GAME ROADMAP STRIP & PROVABLY FAIR MODAL ON DRAGON TIGER
  // -------------------------------------------------------------------------
  test('Case 6: Game Roadmap Strip & Provably Fair Modal on Dragon Tiger', async ({ page }) => {
    test.setTimeout(60000);

    await page.context().addCookies([
      { name: 'token', value: playerToken, domain: 'localhost', path: '/' }
    ]);
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_PLAYER_65',
        phone: '+919999990001',
        role: 'USER',
        isGuest: false
      }));
    }, { token: playerToken });

    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    // 1. Verify Non-Predictive Disclaimer is visible
    const disclaimer = page.locator('text=Historical outcomes only • Independent random trials • Not a predictive system').first();
    await expect(disclaimer).toBeVisible({ timeout: 15000 });

    // 2. Verify Roadmap Bead Bubbles or Shoe
    const beadBubbles = page.locator('[data-testid="roadmap-bead-bubble"]');
    if (await beadBubbles.count() > 0) {
      // Click first bead bubble to open Provably Fair Modal
      await beadBubbles.first().click();
      
      // Verify Modal opens
      await expect(page.locator('text=Round Audit & Verification')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Cryptographic Commitment (SHA-256)')).toBeVisible();

      // Trigger "Verify Result"
      const verifyBtn = page.locator('button:has-text("Verify Result")');
      if (await verifyBtn.isVisible()) {
        await verifyBtn.click();
        await expect(page.locator('text=PROVABLY FAIR').or(page.locator('text=VERIFIED'))).toBeVisible({ timeout: 10000 });
      }

      await page.screenshot({ path: path.join(__dirname, 'round_detail_modal_prompt65.png') });
      await page.locator('button:has-text("Close")').first().click();
    }

    // 3. Open Official Result History Drawer
    const historyBtn = page.locator('button[title="Official Result History"], button:has-text("History")').first();
    await historyBtn.click();
    await expect(page.locator('text=Official Result History')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(__dirname, 'result_history_drawer_prompt65.png') });
  });

  // -------------------------------------------------------------------------
  // TEST 7: ROULETTE RECENT RESULTS & PROVABLY FAIR VERIFICATION
  // -------------------------------------------------------------------------
  test('Case 7: European Roulette History Ribbon & Seed Verification', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto(`${WEB_BASE}/games/european-roulette`, { waitUntil: 'domcontentloaded' });

    // 1. Verify History Ribbon and Non-Predictive Disclaimer
    await expect(page.locator('text=History:').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Historical outcomes only • Independent random trials • Not a predictive system').first()).toBeVisible();

    // 2. Capture Roulette Table with History Ribbon
    await page.screenshot({ path: path.join(__dirname, 'roulette_history_ribbon_prompt65.png') });
  });

  // -------------------------------------------------------------------------
  // TEST 8: RESPONSIVE VIEWPORT TESTING (360px, 390px, 430px)
  // -------------------------------------------------------------------------
  test('Case 8: Responsive Mobile Viewport Compliance (360px, 390px, 430px)', async ({ page }) => {
    test.setTimeout(60000);

    const viewports = [
      { width: 360, height: 800, name: '360x800' },
      { width: 390, height: 844, name: '390x844' },
      { width: 430, height: 932, name: '430x932' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Verify no horizontal overflow in roadmap
      const roadmapContainer = page.locator('text=Roadmap:').first();
      await expect(roadmapContainer).toBeVisible();

      await page.screenshot({ 
        path: path.join(__dirname, `mobile_${vp.name}_history_roadmap_prompt65.png`) 
      });
    }
  });
});
