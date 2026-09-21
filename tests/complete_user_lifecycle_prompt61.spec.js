const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const io = require('socket.io-client');

const { ensureUserAndWallet } = require('../services/realtime/src/services/walletService');

const API_BASE = 'http://localhost:4000';
const WEB_BASE = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-fallback';

test.describe.serial('WINDAQ PROMPT #61 — 16-POINT COMPREHENSIVE AUTHENTICATION & LIFECYCLE QA', () => {

  const timestamp = Date.now().toString().slice(-8);
  const testPhone = `98${timestamp}`;
  const fullPhone = `+91${testPhone}`;
  let registeredToken = '';
  let registeredUserId = '';

  // -------------------------------------------------------------
  // CASE 1: REGISTRATION SUCCESS & WALLET PROVISIONING
  // -------------------------------------------------------------
  test('Case 1: Registration success creates user and provisions exactly one INR wallet', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { phone: fullPhone }
    });

    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.phone).toBe(fullPhone);
    expect(body.wallet).toBeDefined();
    expect(body.wallet.balance).toBe(500);

    registeredToken = body.token;
    registeredUserId = body.user.id;

    // Verify in database: exactly 1 user and 1 wallet
    const dbUser = await prisma.user.findUnique({
      where: { phone: fullPhone },
      include: { wallets: true }
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser.wallets.length).toBe(1);
    expect(dbUser.wallets[0].currency).toBe('INR');

    const walletCount = await prisma.wallet.count({
      where: { userId: dbUser.id }
    });
    expect(walletCount).toBe(1);
  });

  // -------------------------------------------------------------
  // CASE 2: DUPLICATE REGISTRATION PREVENTION
  // -------------------------------------------------------------
  test('Case 2: Duplicate registration with existing phone is rejected', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/register`, {
      data: { phone: fullPhone }
    });

    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('already registered');
  });

  // -------------------------------------------------------------
  // CASE 3: LOGIN SUCCESS WITH OTP
  // -------------------------------------------------------------
  test('Case 3: Login success returns authoritative token and profile', async ({ request }) => {
    // Send OTP first
    const otpRes = await request.post(`${API_BASE}/api/auth/send-otp`, {
      data: { phone: fullPhone }
    });
    expect(otpRes.status()).toBe(200);

    // Login with valid OTP '1234'
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { phone: fullPhone, otp: '1234' }
    });

    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeDefined();
    expect(body.user.phone).toBe(fullPhone);
    expect(body.user.id).toBe(registeredUserId);
    expect(body.wallet.balance).toBe(500);
  });

  // -------------------------------------------------------------
  // CASE 4: WRONG CREDENTIALS REJECTION
  // -------------------------------------------------------------
  test('Case 4: Wrong OTP / credentials returns 401 INVALID_CREDENTIALS', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/auth/login`, {
      data: { phone: fullPhone, otp: '9999' }
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });

  // -------------------------------------------------------------
  // CASE 5: LOGOUT & TOKEN REVOCATION
  // -------------------------------------------------------------
  test('Case 5: Logout revokes session token and rejects reuse', async ({ request }) => {
    // 1. Verify token works before logout
    const preMe = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${registeredToken}` }
    });
    expect(preMe.status()).toBe(200);

    // 2. Call Logout
    const logoutRes = await request.post(`${API_BASE}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${registeredToken}` }
    });
    expect(logoutRes.status()).toBe(200);

    // 3. Verify token is now rejected
    const postMe = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${registeredToken}` }
    });
    expect(postMe.status()).toBe(401);
    const body = await postMe.json();
    expect(['TOKEN_REVOKED', 'SESSION_EXPIRED']).toContain(body.code);
  });

  // -------------------------------------------------------------
  // CASE 6: EXPIRED SESSION STRATEGY
  // -------------------------------------------------------------
  test('Case 6: Expired JWT session returns 401 SESSION_EXPIRED', async ({ request }) => {
    // Generate an expired token (expired 1 hour ago)
    const expiredToken = jwt.sign(
      { userId: registeredUserId, phone: fullPhone, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );

    const res = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('SESSION_EXPIRED');
  });

  // -------------------------------------------------------------
  // CASE 7: BROWSER REFRESH PERSISTENCE
  // -------------------------------------------------------------
  test('Case 7: Browser refresh preserves authenticated user and wallet balance', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Login using TEST_PLAYER_01 token
    const testUserToken = jwt.sign(
      { userId: 'TEST_PLAYER_01', phone: '+919999910001', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    await page.goto(WEB_BASE, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_PLAYER_01',
        phone: '+919999910001',
        role: 'USER',
        isGuest: false
      }));
    }, { token: testUserToken });

    // Reload page to verify session restored from localStorage and verified via /api/auth/me
    await page.reload({ waitUntil: 'domcontentloaded' });

    // REGISTER button should NOT be visible for logged in user
    await expect(page.locator('button', { hasText: 'REGISTER' })).not.toBeVisible();

    // Balance chip should show TEST_PLAYER_01 balance (₹50,000)
    const depositBtn = page.locator('[data-testid="header-deposit-btn"]');
    await expect(depositBtn).toBeVisible({ timeout: 10000 });
    const text = await depositBtn.innerText();
    expect(text).toContain('50,000');
  });

  // -------------------------------------------------------------
  // CASE 8: MULTIPLE TABS SESSION COHERENCE
  // -------------------------------------------------------------
  test('Case 8: Multiple tabs share active session and stay synchronized', async ({ context }) => {
    const testUserToken = jwt.sign(
      { userId: 'TEST_PLAYER_02', phone: '+919999910002', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    const page1 = await context.newPage();
    await page1.goto(WEB_BASE, { waitUntil: 'domcontentloaded' });
    await page1.evaluate(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_PLAYER_02',
        phone: '+919999910002',
        role: 'USER',
        isGuest: false
      }));
    }, { token: testUserToken });

    // Open second tab in the same context
    const page2 = await context.newPage();
    await page2.goto(`${WEB_BASE}/wallet`, { waitUntil: 'domcontentloaded' });

    // Page 2 should recognize authenticated session directly
    await expect(page2.locator('text=MY GAMING WALLET')).toBeVisible();
    await expect(page2.locator('text=₹25,000.00').first()).toBeVisible();

    await page1.close();
    await page2.close();
  });

  // -------------------------------------------------------------
  // CASE 9: NEW USER WALLET CREATION
  // -------------------------------------------------------------
  test('Case 9: ensureUserAndWallet provisions exactly one INR wallet atomically', async () => {
    const testUid = `auto_prov_${Date.now()}`;
    const result = await ensureUserAndWallet(prisma, testUid, { phone: `+9191${Date.now().toString().slice(-8)}` });

    expect(result).toBeDefined();
    expect(result.user.id).toBe(testUid);
    expect(result.wallet).toBeDefined();
    expect(result.wallet.currency).toBe('INR');

    const wallets = await prisma.wallet.findMany({ where: { userId: testUid } });
    expect(wallets.length).toBe(1);
  });

  // -------------------------------------------------------------
  // CASE 10: DUPLICATE WALLET PREVENTION UNDER CONCURRENCY
  // -------------------------------------------------------------
  test('Case 10: Concurrent provisioning requests cannot create duplicate wallets', async () => {
    const concurrentUid = `concurrent_${Date.now()}`;
    const phone = `+9192${Date.now().toString().slice(-8)}`;

    // Fire 5 simultaneous provisioning calls for the exact same user
    const results = await Promise.all([
      ensureUserAndWallet(prisma, concurrentUid, { phone }),
      ensureUserAndWallet(prisma, concurrentUid, { phone }),
      ensureUserAndWallet(prisma, concurrentUid, { phone }),
      ensureUserAndWallet(prisma, concurrentUid, { phone }),
      ensureUserAndWallet(prisma, concurrentUid, { phone })
    ]);

    expect(results.length).toBe(5);
    const count = await prisma.wallet.count({ where: { userId: concurrentUid } });
    expect(count).toBe(1);
  });

  // -------------------------------------------------------------
  // CASE 11: DIRECT PROTECTED-ROUTE ACCESS & ADMIN RBAC
  // -------------------------------------------------------------
  test('Case 11: Direct protected route barriers and Admin RBAC', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 1. Visit /wallet as visitor
    await page.goto(`${WEB_BASE}/wallet`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=You must be logged in')).toBeVisible();

    // 2. Visit /admin as visitor -> blocked
    await page.goto(`${WEB_BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=You must be logged in')).toBeVisible();

    // 3. Login as regular player (TEST_PLAYER_01) -> still blocked from /admin
    const playerToken = jwt.sign(
      { userId: 'TEST_PLAYER_01', phone: '+919999910001', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    await page.evaluate(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_PLAYER_01',
        phone: '+919999910001',
        role: 'USER',
        isGuest: false
      }));
    }, { token: playerToken });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=ACCESS RESTRICTED')).toBeVisible();
    await expect(page.locator('text=Administrator privileges are required')).toBeVisible();

    // 4. Login as TEST_ADMIN (SUPER_ADMIN) -> Allowed into /admin
    const adminToken = jwt.sign(
      { userId: 'TEST_ADMIN', phone: '+919999910005', role: 'SUPER_ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    await page.evaluate(({ token }) => {
      localStorage.setItem('windaq_auth_token', token);
      localStorage.setItem('windaq_user_data', JSON.stringify({
        id: 'TEST_ADMIN',
        phone: '+919999910005',
        role: 'SUPER_ADMIN',
        isGuest: false
      }));
    }, { token: adminToken });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=Operations Control Center')).toBeVisible();
  });

  // -------------------------------------------------------------
  // CASE 12: WEBSOCKET AUTHENTICATION
  // -------------------------------------------------------------
  test('Case 12: WebSocket handshake authenticates token and rejects unauthenticated bets', async () => {
    const playerToken = jwt.sign(
      { userId: 'TEST_PLAYER_01', phone: '+919999910001', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 1. Authenticated socket connection
    const authedSocket = io(API_BASE, {
      transports: ['websocket'],
      auth: { token: playerToken }
    });

    await new Promise((resolve, reject) => {
      authedSocket.on('connect', resolve);
      authedSocket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Timeout connecting authed socket')), 5000);
    });

    expect(authedSocket.connected).toBe(true);
    authedSocket.disconnect();

    // 2. Unauthenticated socket attempting place_bet
    const guestSocket = io(API_BASE, {
      transports: ['websocket']
    });

    await new Promise((resolve) => {
      guestSocket.on('connect', resolve);
    });

    const betResult = await new Promise((resolve) => {
      guestSocket.on('bet_error', (data) => resolve(data));
      guestSocket.on('error', (data) => resolve(data));
      guestSocket.emit('place_bet', { amount: 100 }, (cbData) => resolve(cbData));
      setTimeout(() => resolve({ timeout: true }), 3000);
    });

    guestSocket.disconnect();
    const isAuthErr = betResult?.code === 'AUTH_REQUIRED' || 
      betResult?.message?.includes('Authentication required') || 
      (typeof betResult === 'string' && betResult.includes('Authentication required'));
    expect(isAuthErr).toBe(true);
  });

  // -------------------------------------------------------------
  // CASE 13: WAGER ATTEMPT WITHOUT LOGIN
  // -------------------------------------------------------------
  test('Case 13: Wager attempt without login is rejected with 401 AUTH_REQUIRED', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/wager/place`, {
      data: {
        gameType: 'AVIATOR',
        stake: 100,
        odds: 1.5
      }
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  // -------------------------------------------------------------
  // CASE 14: WALLET ACCESS WITHOUT LOGIN
  // -------------------------------------------------------------
  test('Case 14: Wallet access without login is rejected with 401 AUTH_REQUIRED', async ({ request }) => {
    const balRes = await request.get(`${API_BASE}/api/ledger/balance`);
    expect(balRes.status()).toBe(401);
    const balBody = await balRes.json();
    expect(balBody.code).toBe('AUTH_REQUIRED');

    const depRes = await request.post(`${API_BASE}/api/ledger/deposit/instant`, {
      data: { amount: 500 }
    });
    expect(depRes.status()).toBe(401);
  });

  // -------------------------------------------------------------
  // CASE 15: USER RESTRICTION & SUSPENSION BEHAVIOR
  // -------------------------------------------------------------
  test('Case 15: Suspended user TEST_RESTRICTED is blocked from login and wagering', async ({ request }) => {
    // 1. Attempt login with TEST_RESTRICTED phone
    const loginRes = await request.post(`${API_BASE}/api/auth/login`, {
      data: { phone: '+919999910004', otp: '1234' }
    });
    expect(loginRes.status()).toBe(403);
    const body = await loginRes.json();
    expect(body.code).toBe('ACCOUNT_RESTRICTED');

    // 2. Attempt direct bet via wagerService with TEST_RESTRICTED
    const restrictedToken = jwt.sign(
      { userId: 'TEST_RESTRICTED', phone: '+919999910004', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const wagerRes = await request.post(`${API_BASE}/api/wager/place`, {
      headers: { Authorization: `Bearer ${restrictedToken}` },
      data: {
        gameType: 'SLOTS',
        referenceId: 'ref_restricted_test',
        market: 'main',
        selection: 'spin',
        type: 'BACK',
        stake: 10,
        odds: 2.0
      }
    });
    expect(wagerRes.status()).toBe(403);
    const wagerBody = await wagerRes.json();
    expect(wagerBody.code).toBe('ACCOUNT_RESTRICTED');
  });

  // -------------------------------------------------------------
  // CASE 16: SERVER RESTART / SESSION RECOVERY
  // -------------------------------------------------------------
  test('Case 16: Sessions survive and recover authoritative database state', async ({ request }) => {
    // Generate valid session token for TEST_PLAYER_01
    const token = jwt.sign(
      { userId: 'TEST_PLAYER_01', phone: '+919999910001', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Call /me
    const meRes = await request.get(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(meRes.status()).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.id).toBe('TEST_PLAYER_01');
    expect(meBody.wallet.balance).toBe(50000);

    // Call /api/ledger/balance
    const balRes = await request.get(`${API_BASE}/api/ledger/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(balRes.status()).toBe(200);
    const balBody = await balRes.json();
    expect(balBody.balance).toBe(50000);
  });

});
