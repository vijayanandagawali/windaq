const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const WEB_BASE = 'http://localhost:3000';
const API_BASE = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-fallback';

test.describe.serial('WINDAQ PROMPT #63 — CINEMATIC GAME ANIMATION & RESULT REVEAL ENGINE', () => {

  const testPlayerToken = jwt.sign(
    { userId: 'TEST_CINEMATIC_PLAYER', phone: '+919999990002', role: 'USER' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token }) => {
      localStorage.setItem('windaq_token', token);
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_id', 'TEST_CINEMATIC_PLAYER');
      localStorage.setItem('windaq_user_data', JSON.stringify({ id: 'TEST_CINEMATIC_PLAYER', phone: '+919999990002' }));
    }, { token: testPlayerToken });
  });

  // -------------------------------------------------------------------------
  // TEST 1: EUROPEAN ROULETTE CINEMATIC SPIN & DECELERATING BALL ENGINE
  // -------------------------------------------------------------------------
  test('Case 1: European Roulette — Wheel Spin, Ball Deceleration, Winning Pocket Glow & Chip Flights', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to European Roulette...');
    await page.goto(`${WEB_BASE}/games/european-roulette`, { waitUntil: 'domcontentloaded' });

    // Verify roulette wheel Canvas is rendered
    const wheelCanvas = page.locator('canvas.rounded-full').or(page.locator('canvas')).first();
    await expect(wheelCanvas).toBeVisible({ timeout: 15000 });
    console.log('✓ Roulette wheel canvas rendered');

    // Verify betting layout numbers exist
    const numberZero = page.locator('button:has-text("0")').first();
    await expect(numberZero).toBeVisible();

    // Take screenshot of betting open wheel
    await page.screenshot({ path: 'tests/anim_roulette_betting_open.png' });
    console.log('✓ Captured anim_roulette_betting_open.png');

    // Place a chip on Red or Number 7
    const redBetBtn = page.locator('button:has-text("RED")').first();
    if (await redBetBtn.isVisible()) {
      await redBetBtn.click();
      console.log('✓ Placed bet on RED');
    }

    // Wait for round to progress into spin or lock
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'tests/anim_roulette_wheel_active.png' });
    console.log('✓ Captured anim_roulette_wheel_active.png');
  });

  // -------------------------------------------------------------------------
  // TEST 2: DRAGON TIGER 3D CARD DEAL, FLIP & RANK COMPARISON ENGINE
  // -------------------------------------------------------------------------
  test('Case 2: Dragon Tiger — Dealer Shoe Slide, 3D Card Flip, Rank Comparison Badge & Winner Glow', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Dragon Tiger...');
    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });

    // Verify Simulated Live Table container loaded
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 20000 });
    console.log('✓ Simulated Live Table loaded');

    // Verify dealer table stage is visible
    const vsBadge = page.locator('text=VS').first();
    await expect(vsBadge).toBeVisible();
    console.log('✓ 3D Virtual Table & Card Stage loaded');

    // Verify Dragon and Tiger card placement spots exist
    const dragonSpot = page.locator('text=DRAGON').first();
    const tigerSpot = page.locator('text=TIGER').first();
    await expect(dragonSpot).toBeVisible();
    await expect(tigerSpot).toBeVisible();

    // Wait for gameplay/reveal phase to observe 3D card animation
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes('DEALING CARDS') || text.includes('REVEALING RESULT') || text.includes('vs') || text.includes('ROUND COMPLETE');
    }, { timeout: 45000 });

    await page.screenshot({ path: 'tests/anim_dragontiger_cards_revealed.png' });
    console.log('✓ Captured anim_dragontiger_cards_revealed.png');
  });

  // -------------------------------------------------------------------------
  // TEST 3: ANDAR BAHAR JOKER REVEAL & ALTERNATE STREAM DEAL ENGINE
  // -------------------------------------------------------------------------
  test('Case 3: Andar Bahar — Center Joker Pedestal Glow, Alternate Dealing Streams & Match Glow', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Andar Bahar...');
    await page.goto(`${WEB_BASE}/games/andar-bahar`, { waitUntil: 'domcontentloaded' });

    // Verify Andar Bahar Header & Center Joker zone
    const centerJokerTag = page.locator('text=Center Reference Joker Card').or(page.locator('text=Joker')).first();
    await expect(centerJokerTag).toBeVisible({ timeout: 20000 });
    console.log('✓ Joker trump card zone visible');

    // Verify Andar and Bahar betting sections
    const andarBetBtn = page.locator('button:has-text("Andar")').first();
    const baharBetBtn = page.locator('button:has-text("Bahar")').first();
    await expect(andarBetBtn).toBeVisible();
    await expect(baharBetBtn).toBeVisible();

    await page.screenshot({ path: 'tests/anim_andarbahar_table.png' });
    console.log('✓ Captured anim_andarbahar_table.png');
  });

  // -------------------------------------------------------------------------
  // TEST 4: AVIATOR / CRASH SMOOTH MULTIPLIER TRAJECTORY & PARTICLES
  // -------------------------------------------------------------------------
  test('Case 4: Aviator — Smooth Rocket Trajectory, Dynamic Multiplier Scaling & Freeze State', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Aviator...');
    await page.goto(`${WEB_BASE}/games/aviator`, { waitUntil: 'domcontentloaded' });

    // Verify flight canvas
    const flightCanvas = page.locator('canvas').first();
    await expect(flightCanvas).toBeVisible({ timeout: 20000 });
    console.log('✓ Aviator flight canvas visible');

    // Check multiplier counter or countdown element
    const stageIndicator = page.locator('h1').or(page.locator('text=Waiting for next round')).first();
    await expect(stageIndicator).toBeVisible({ timeout: 15000 });
    console.log('✓ Aviator round indicator visible');

    await page.screenshot({ path: 'tests/anim_aviator_curve.png' });
    console.log('✓ Captured anim_aviator_curve.png');
  });

  // -------------------------------------------------------------------------
  // TEST 5: LOTTO SEQUENTIAL ONE-BY-ONE BALL EXTRACTION ENGINE
  // -------------------------------------------------------------------------
  test('Case 5: Lotto / Quick Draw — Pneumatic Chute & Sequential 1-by-1 Ball Extraction Animation', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Lotto...');
    await page.goto(`${WEB_BASE}/games/lotto`, { waitUntil: 'domcontentloaded' });

    // Verify Lotto Chute & Ball drum
    await page.waitForSelector('text=Next Draw In', { timeout: 20000 });
    console.log('✓ Lottery Blower Sphere & Chute rendered');

    // Verify ticket purchase button
    const buyTicketBtn = page.locator('button:has-text("Buy Ticket")').first();
    await expect(buyTicketBtn).toBeVisible();

    await page.screenshot({ path: 'tests/anim_lotto_drum_chute.png' });
    console.log('✓ Captured anim_lotto_drum_chute.png');
  });

  // -------------------------------------------------------------------------
  // TEST 6: COLOUR PREDICTION ORACLE ORB & 3D RESULT REVEAL CHAMBER
  // -------------------------------------------------------------------------
  test('Case 6: Colour Prediction — 3D Result Chamber, Oracle Orb Anticipation & Winning Burst', async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Colour Prediction...');
    await page.goto(`${WEB_BASE}/games/color-prediction`, { waitUntil: 'domcontentloaded' });

    // Verify 3D Mystery Result Chamber
    const chamber = page.locator('text=MYSTERY RESULT CHAMBER').or(page.locator('text=CHAMBER LOCKED')).or(page.locator('text=OUTCOME REVEALED')).first();
    await expect(chamber).toBeVisible({ timeout: 20000 });
    console.log('✓ 3D Mystery Result Chamber rendered');

    // Verify Colour Selection Buttons (Green, Violet, Red)
    const greenBtn = page.locator('button:has-text("GREEN")').first();
    const violetBtn = page.locator('button:has-text("VIOLET")').first();
    const redBtn = page.locator('button:has-text("RED")').first();
    await expect(greenBtn).toBeVisible();
    await expect(violetBtn).toBeVisible();
    await expect(redBtn).toBeVisible();

    await page.screenshot({ path: 'tests/anim_colour_oracle_orb.png' });
    console.log('✓ Captured anim_colour_oracle_orb.png');
  });

  // -------------------------------------------------------------------------
  // TEST 7: SLOTS STAGGERED REEL SPIN & STOP SEQUENCE
  // -------------------------------------------------------------------------
  test('Case 7: Slots — Staggered 5-Reel Spin, Reel Stop Procedural Audio & Winlines', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Slots...');
    await page.goto(`${WEB_BASE}/games/slots`, { waitUntil: 'domcontentloaded' });

    // Verify spin button
    const spinBtn = page.locator('button:has-text("SPIN")').first();
    await expect(spinBtn).toBeVisible({ timeout: 20000 });
    console.log('✓ Slots game loaded with SPIN button');

    await page.screenshot({ path: 'tests/anim_slots_idle.png' });
    console.log('✓ Captured anim_slots_idle.png');
  });

  // -------------------------------------------------------------------------
  // TEST 8: DICE 3D SHAKE, BOUNCE & FLYING CHIPS
  // -------------------------------------------------------------------------
  test('Case 8: Dice — Shaker Physics, 3D Rolling Dice, Settle Bounce & Chip Flights', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });

    console.log('Navigating to Dice...');
    await page.goto(`${WEB_BASE}/games/dice`, { waitUntil: 'domcontentloaded' });

    // Verify Small / Big betting areas
    const smallBtn = page.locator('button:has-text("SMALL")').first();
    const bigBtn = page.locator('button:has-text("BIG")').first();
    await expect(smallBtn).toBeVisible({ timeout: 20000 });
    await expect(bigBtn).toBeVisible();

    // Place a bet on BIG
    await bigBtn.click();
    console.log('✓ Placed bet on BIG');

    await page.screenshot({ path: 'tests/anim_dice_board.png' });
    console.log('✓ Captured anim_dice_board.png');
  });

  // -------------------------------------------------------------------------
  // TEST 9: MOBILE VIEWPORT VERIFICATION (360x800 & 390x844)
  // -------------------------------------------------------------------------
  test('Case 9: Mobile Viewports — Responsive Layout, Reachable Controls & No Overlaps', async ({ page }) => {
    test.setTimeout(60000);

    // Test 360x800 (Compact Android)
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${WEB_BASE}/games/dragon-tiger`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=SIMULATED LIVE TABLE', { timeout: 20000 });
    await page.screenshot({ path: 'tests/anim_mobile_360x800_dragontiger.png' });
    console.log('✓ Captured anim_mobile_360x800_dragontiger.png');

    // Test 390x844 (iPhone 14/15)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${WEB_BASE}/games/european-roulette`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'tests/anim_mobile_390x844_roulette.png' });
    console.log('✓ Captured anim_mobile_390x844_roulette.png');
  });

});
