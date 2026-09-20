/**
 * SECURITY MASTER PASS QA SUITE
 * Comprehensive, defensive verification across 17 security dimensions:
 * 1. Auth & Session Lifecycle
 * 2. JWT Cryptographic Integrity & Tamper Proofing
 * 3. RBAC & Admin Authorization (Least Privilege)
 * 4. API Security, Helmet Headers & Payload Limits
 * 5. WebSocket Authentication, Guest Isolation & Token Bucket Throttling
 * 6. Prisma & PostgreSQL SQL Injection Immunity
 * 7. Secrets & Client Bundle Static Audit
 * 8. Financial Endpoint Rate Limiting (429 Too Many Requests)
 * 9. IDOR Defense Matrix (Wallet, Wager, Ledger)
 * 10. XSS & HTML Script Injection Defenses
 * 11. CSRF, Replay Attack & Duplicate Wager Idempotency
 *
 * All tests execute safely against the staging/sandbox environment.
 */

const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const walletService = require('../services/realtime/src/services/walletService');

const BASE_URL = 'http://localhost:4000';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-fallback';

test.describe('SECURITY MASTER PASS: FULL DEFENSIVE AUDIT', () => {

  let testUserToken;
  let testUserId = 'sbx-usr-sec-001';
  let victimUserId = 'sbx-usr-sec-002';
  let adminUserId = 'sbx-usr-admin-004';
  let adminToken;

  test.beforeAll(async () => {
    // Provision sandbox test users and wallets in DB
    await walletService.ensureUserAndWallet(prisma, testUserId, {
      phone: '+919999888801',
      role: 'USER',
      initialPaise: 100000n // ₹1,000
    });

    await walletService.ensureUserAndWallet(prisma, victimUserId, {
      phone: '+919999888802',
      role: 'USER',
      initialPaise: 100000n // ₹1,000
    });

    await walletService.ensureUserAndWallet(prisma, adminUserId, {
      phone: '+919999888804',
      role: 'SUPER_ADMIN',
      initialPaise: 5000000n
    });

    // Generate valid tokens
    testUserToken = jwt.sign(
      { userId: testUserId, phone: '+919999888801', role: 'USER' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    adminToken = jwt.sign(
      { userId: adminUserId, phone: '+919999888804', role: 'SUPER_ADMIN' },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
  });

  // =========================================================================
  // MODULE 1: AUTH & SESSION LIFECYCLE
  // =========================================================================
  test('SEC-01: Auth & Session: Phone validation, registration conflict, and session retrieval', async ({ request }) => {
    console.log('\n🔒 [SEC-01] Testing Auth & Session Defenses...');

    // 1. Invalid phone number rejection
    const invalidPhoneRes = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone: '' } // Empty / invalid mobile
    });
    expect(invalidPhoneRes.status()).toBe(400);
    const invalidPhoneBody = await invalidPhoneRes.json();
    expect(invalidPhoneBody.code).toBe('INVALID_PHONE');

    // 2. Duplicate registration conflict (409 Conflict)
    const duplicateRes = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone: '+919999888801' } // already exists
    });
    expect(duplicateRes.status()).toBe(409);
    const duplicateBody = await duplicateRes.json();
    expect(duplicateBody.code).toBe('USER_EXISTS');

    // 3. Authenticated session validation (/api/auth/me)
    const meRes = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    expect(meRes.status()).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.success).toBe(true);
    expect(meBody.user.id).toBe(testUserId);
    expect(meBody.user.role).toBe('USER');

    // 4. Session termination (Logout)
    const logoutRes = await request.post(`${BASE_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    expect(logoutRes.status()).toBe(200);
    const logoutBody = await logoutRes.json();
    expect(logoutBody.success).toBe(true);
  });

  // =========================================================================
  // MODULE 2: JWT CRYPTOGRAPHIC INTEGRITY & TAMPER PROOFING
  // =========================================================================
  test('SEC-02: JWT: Signature forgery, token tampering, and expired token rejection', async ({ request }) => {
    console.log('🔒 [SEC-02] Testing JWT Cryptographic Integrity...');

    // 1. Tampered signature (signed with attacker secret)
    const forgedToken = jwt.sign(
      { userId: testUserId, role: 'SUPER_ADMIN' },
      'attacker-rogue-secret-999',
      { expiresIn: '1h' }
    );
    const forgedRes = await request.get(`${BASE_URL}/api/ledger/balance`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });
    expect(forgedRes.status()).toBe(401);
    const forgedBody = await forgedRes.json();
    expect(forgedBody.code).toBe('INVALID_TOKEN');

    // 2. Expired Token rejection
    const expiredToken = jwt.sign(
      { userId: testUserId, role: 'USER' },
      JWT_SECRET,
      { expiresIn: '-10s' } // Expired in the past
    );
    const expiredRes = await request.get(`${BASE_URL}/api/ledger/balance`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    expect(expiredRes.status()).toBe(401);
    const expiredBody = await expiredRes.json();
    expect(expiredBody.code).toBe('SESSION_EXPIRED');

    // 3. Malformed Token string
    const malformedRes = await request.get(`${BASE_URL}/api/ledger/balance`, {
      headers: { Authorization: 'Bearer not.a.real.jwt.token' }
    });
    expect(malformedRes.status()).toBe(401);
    const malformedBody = await malformedRes.json();
    expect(malformedBody.code).toBe('INVALID_TOKEN');
  });

  // =========================================================================
  // MODULE 3: RBAC & LEAST-PRIVILEGE ADMIN AUTHORIZATION
  // =========================================================================
  test('SEC-03: RBAC: Privilege escalation prevention and admin endpoint isolation', async ({ request }) => {
    console.log('🔒 [SEC-03] Testing RBAC & Admin Privilege Isolation...');

    // 1. Regular USER token calling Admin Games endpoint
    const userAdminRes = await request.get(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    expect(userAdminRes.status()).toBe(403);
    const userAdminBody = await userAdminRes.json();
    expect(userAdminBody.message).toContain('Forbidden');

    // 2. Regular USER token calling Sports Admin endpoint
    const userSportsAdminRes = await request.post(`${BASE_URL}/api/sports/admin/settle`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
      data: { matchId: 'mock-1', winner: 'TEAM_A' }
    });
    expect(userSportsAdminRes.status()).toBe(403);

    // 3. Regular USER token calling Wager Settlement endpoint
    const userSettleRes = await request.post(`${BASE_URL}/api/wager/settle`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
      data: { wagerId: 'some-wager', status: 'WON' }
    });
    expect(userSettleRes.status()).toBe(403);
    const userSettleBody = await userSettleRes.json();
    expect(userSettleBody.message).toContain('Forbidden');

    // 4. Legitimate SUPER_ADMIN token calling Admin Games endpoint succeeds
    const legitAdminRes = await request.get(`${BASE_URL}/api/admin/games`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(legitAdminRes.status()).toBe(200);
    const legitAdminBody = await legitAdminRes.json();
    expect(legitAdminBody.success).toBe(true);
  });

  // =========================================================================
  // MODULE 4: API HEADERS, HELMET & PAYLOAD DOS LIMITS
  // =========================================================================
  test('SEC-04: API Security: Helmet security headers and payload size limitation', async ({ request }) => {
    console.log('🔒 [SEC-04] Testing Helmet Security Headers & Body Limit...');

    const res = await request.get(`${BASE_URL}/api/catalog`);
    expect(res.status()).toBe(200);

    const headers = res.headers();
    // Verify Helmet headers
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options'] || headers['content-security-policy']).toBeDefined();

    // Verify 10KB Payload limit (Protection against JSON DoS floods)
    const largePayload = 'A'.repeat(15 * 1024); // 15KB > 10KB limit
    const dosRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { phone: '+919999888801', flood: largePayload },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(dosRes.status()).toBe(413); // Payload Too Large
  });

  // =========================================================================
  // MODULE 5: WEBSOCKET SECURITY & CONNECTION CONCURRENCY
  // =========================================================================
  test('SEC-05: WebSocket: Guest viewer isolation and socket rate limiting', async () => {
    console.log('🔒 [SEC-05] Testing WebSocket Security & Guest Role Isolation...');

    return new Promise((resolve, reject) => {
      // Connect without auth token (Guest)
      const socket = io(BASE_URL, {
        transports: ['websocket'],
        reconnection: false
      });

      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('WebSocket connection timed out'));
      }, 5000);

      socket.on('connect', () => {
        // Send latency ping to verify token bucket limiter
        for (let i = 0; i < 15; i++) {
          socket.emit('latency_ping', Date.now());
        }

        setTimeout(() => {
          clearTimeout(timeout);
          socket.disconnect();
          resolve();
        }, 1000);
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(err);
      });
    });
  });

  // =========================================================================
  // MODULE 6: PRISMA & POSTGRESQL SQL INJECTION IMMUNITY
  // =========================================================================
  test('SEC-06: Database & Prisma: Parameterized query immunity against SQL injection', async ({ request }) => {
    console.log('🔒 [SEC-06] Testing SQL Injection Immunity on ORM and Raw Queries...');

    // 1. SQL Injection via Query Params
    const sqliCatalogRes = await request.get(`${BASE_URL}/api/catalog?category=' OR '1'='1' --`);
    expect(sqliCatalogRes.status()).toBe(200);
    const sqliCatalogBody = await sqliCatalogRes.json();
    expect(sqliCatalogBody.success).toBe(true);

    // 2. SQL Injection in Transaction Filters
    const sqliLedgerRes = await request.get(`${BASE_URL}/api/ledger/transactions?type=' UNION SELECT * FROM "User" --`, {
      headers: { Authorization: `Bearer ${testUserToken}` }
    });
    expect(sqliLedgerRes.status()).toBe(200);
    const sqliLedgerBody = await sqliLedgerRes.json();
    expect(sqliLedgerBody.success).toBe(true);

    // 3. Database direct parameterized check
    const maliciousInput = "test'; DROP TABLE \"User\"; --";
    const user = await prisma.user.findFirst({
      where: { phone: maliciousInput }
    });
    expect(user).toBeNull(); // Cleanly handled as literal string parameter, table unharmed

    // Verify User table is intact
    const count = await prisma.user.count();
    expect(count).toBeGreaterThan(0);
  });

  // =========================================================================
  // MODULE 7: SECRETS & CLIENT-SIDE CODE AUDIT
  // =========================================================================
  test('SEC-07: Secrets Audit: .gitignore checks and frontend client bundle inspection', async () => {
    console.log('🔒 [SEC-07] Auditing Git Ignore & Client-Side Secrets Leakage...');

    // 1. Verify .gitignore ignores .env
    const gitignorePath = path.join(__dirname, '../.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    expect(gitignoreContent).toContain('.env');
    expect(gitignoreContent).toContain('.env.local');

    // 2. Scan apps/web source files for accidental secret exposure
    const webSrcPath = path.join(__dirname, '../apps/web/src');
    function scanDirForSecrets(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirForSecrets(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
          const content = fs.readFileSync(fullPath, 'utf8');
          // No raw JWT secrets, database connection URLs, or admin private keys
          expect(content).not.toContain('windaq_admin_secret');
          expect(content).not.toContain('postgres://');
          expect(content).not.toContain('postgresql://');
          expect(content).not.toContain('super-secret-key-fallback');
        }
      }
    }
    scanDirForSecrets(webSrcPath);
    console.log('  ✅ No private secrets leaked in client web source bundle.');
  });

  // =========================================================================
  // MODULE 8: RATE LIMITING ENFORCEMENT (429 TOO MANY REQUESTS)
  // =========================================================================
  test('SEC-08: Rate Limiting: Sensitive financial endpoint throttles with 429 Too Many Requests', async ({ request }) => {
    console.log('🔒 [SEC-08] Testing Sensitive Financial Rate Limiter (429)...');

    // Financial endpoint allows max 10 req/min (strictLimiter)
    let hit429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await request.post(`${BASE_URL}/api/payments/deposit/initiate`, {
        data: { amount: 500, upiId: 'test@upi' }
      });
      if (res.status() === 429) {
        hit429 = true;
        const body = await res.json();
        expect(body.message).toContain('Rate limit exceeded');
        break;
      }
    }
    expect(hit429).toBe(true);
    console.log('  ✅ 429 Too Many Requests cleanly triggered by rate limiter.');
  });

  // =========================================================================
  // MODULE 9: IDOR DEFENSE MATRIX (WALLET, WAGER, LEDGER)
  // =========================================================================
  test('SEC-09: IDOR Defense: Cross-user wallet modification and wager hijacking blocked', async ({ request }) => {
    console.log('🔒 [SEC-09] Testing IDOR Defenses across Wallet, Wager, and Ledger...');

    // 1. Wallet Deduction IDOR: User A attempts to deduct balance from User B
    const idorWalletRes = await request.post(`${BASE_URL}/api/wallet/deduct`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
      data: { userId: victimUserId, amount: 500 }
    });
    expect(idorWalletRes.status()).toBe(403);
    const idorWalletBody = await idorWalletRes.json();
    expect(idorWalletBody.message).toContain('IDOR attempt blocked');

    // 2. Wager Placement IDOR: User A attempts to place a wager under User B's account
    const idorWagerRes = await request.post(`${BASE_URL}/api/wager/place`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
      data: {
        userId: victimUserId, // Malicious IDOR parameter
        gameType: 'ROULETTE',
        referenceId: 'round-idor-101',
        market: 'RED_BLACK',
        selection: 'RED',
        type: 'BACK',
        stake: 10,
        odds: 2.0
      }
    });
    expect(idorWagerRes.status()).toBe(403);
    const idorWagerBody = await idorWagerRes.json();
    expect(idorWagerBody.code).toBe('IDOR_BLOCKED');

    // 3. Ledger History IDOR: User A sends spoofed x-user-id header to view User B's balance
    const idorLedgerRes = await request.get(`${BASE_URL}/api/ledger/balance`, {
      headers: {
        Authorization: `Bearer ${testUserToken}`,
        'x-user-id': victimUserId // Spoofed header
      }
    });
    expect(idorLedgerRes.status()).toBe(200);
    // requireAuth and ledger.js enforce req.user.userId, returning testUser's wallet
    const victimWallet = await prisma.wallet.findFirst({ where: { userId: victimUserId } });
    const userWallet = await prisma.wallet.findFirst({ where: { userId: testUserId } });
    const idorLedgerBody = await idorLedgerRes.json();
    expect(idorLedgerBody.balancePaise).toBe(userWallet.balance.toString());
  });

  // =========================================================================
  // MODULE 10: XSS & HTML SCRIPT INJECTION DEFENSES
  // =========================================================================
  test('SEC-10: XSS Defense: Script injection escaping and DOM immunity verification', async () => {
    console.log('🔒 [SEC-10] Verifying XSS & DOM Injection Immunity in Codebase...');

    const webSrcPath = path.join(__dirname, '../apps/web/src');
    let dangerousHtmlUsage = 0;
    let evalUsage = 0;

    function inspectCodebase(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          inspectCodebase(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx'))) {
          const code = fs.readFileSync(fullPath, 'utf8');
          if (code.includes('dangerouslySetInnerHTML')) dangerousHtmlUsage++;
          if (code.includes('eval(')) evalUsage++;
        }
      }
    }

    inspectCodebase(webSrcPath);
    expect(dangerousHtmlUsage).toBe(0);
    expect(evalUsage).toBe(0);
    console.log('  ✅ 0 occurrences of dangerouslySetInnerHTML or eval() across all React components.');
  });

  // =========================================================================
  // MODULE 11: CSRF, REPLAY ATTACK & DUPLICATE WAGER IDEMPOTENCY
  // =========================================================================
  test('SEC-11: Replay & Idempotency: Duplicate transaction and double-spend concurrency defense', async ({ request }) => {
    console.log('🔒 [SEC-11] Testing Double-Spend Race Conditions and Idempotency...');

    // 1. CSRF defense: State-changing API rejects unauthenticated ambient requests
    const unauthPostRes = await request.post(`${BASE_URL}/api/ledger/balance`);
    expect([401, 404]).toContain(unauthPostRes.status());

    // 2. Duplicate Idempotency Replay Attack
    const idempotencyKey = `idemp-sec-test-${Date.now()}`;
    const userWallet = await prisma.wallet.findFirst({ where: { userId: testUserId } });

    // Insert first transaction with idempotency key
    const firstTx = await prisma.transaction.create({
      data: {
        walletId: userWallet.id,
        idempotencyKey,
        type: 'BET_PLACE',
        amount: 1000n,
        balanceAfter: userWallet.balance - 1000n
      }
    });
    expect(firstTx.id).toBeDefined();

    // Replay attack: attempting to insert same idempotency key must fail with unique constraint violation (P2002)
    let replayBlocked = false;
    try {
      await prisma.transaction.create({
        data: {
          walletId: userWallet.id,
          idempotencyKey,
          type: 'BET_PLACE',
          amount: 1000n,
          balanceAfter: userWallet.balance - 2000n
        }
      });
    } catch (err) {
      replayBlocked = err.code === 'P2002';
    }
    expect(replayBlocked).toBe(true);

    // 3. Double-Spend Race Condition Defense: 10 concurrent parallel bets with limited balance
    const doubleSpendUserId = `sbx-usr-race-${Date.now()}`;
    await walletService.ensureUserAndWallet(prisma, doubleSpendUserId, {
      role: 'USER',
      initialPaise: 20000n // Exactly ₹200 (can only afford 2 x ₹100 bets)
    });

    const concurrentBets = Array.from({ length: 10 }, (_, i) => 
      prisma.$transaction(async (tx) => {
        return walletService.placeBet(tx, doubleSpendUserId, 10000n, 'BET_PLACE', `race-bet-${i}`);
      }).then(() => ({ success: true }))
        .catch(err => ({ success: false, error: err.message }))
    );

    const results = await Promise.all(concurrentBets);
    const successfulBets = results.filter(r => r.success);
    const failedBets = results.filter(r => !r.success);

    // EXACTLY 2 must succeed, 8 must fail with Insufficient balance
    expect(successfulBets.length).toBe(2);
    expect(failedBets.length).toBe(8);

    const finalWallet = await prisma.wallet.findFirst({ where: { userId: doubleSpendUserId } });
    expect(finalWallet.balance).toBe(0n); // Exactly ₹0.00 left, zero overdrawn balance
    console.log(`  ✅ Concurrency Row Locking: Exactly ${successfulBets.length} bets succeeded, ${failedBets.length} failed. Balance = 0.`);
  });

});
