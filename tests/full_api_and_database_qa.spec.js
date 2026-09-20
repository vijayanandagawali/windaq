const { test, expect } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const walletService = require('../services/realtime/src/services/walletService');
const wagerService = require('../services/realtime/src/services/wagerService');

const BASE_URL = 'http://localhost:4000';

test.describe('FULL API STATUS CODE MATRIX QA (200, 400, 401, 403, 404, 409, 429, 500)', () => {

  test('STATUS 200: Public, Authenticated & Admin endpoints return 200 OK with valid payloads', async ({ request }) => {
    // 1. Public catalog
    const catalogRes = await request.get(`${BASE_URL}/api/catalog`);
    expect(catalogRes.status()).toBe(200);
    const catalogBody = await catalogRes.json();
    expect(catalogBody.success).toBe(true);
    expect(Array.isArray(catalogBody.data.categories)).toBe(true);

    // 2. Auth login with valid test credentials
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { phone: '+919876543210', otp: '1234' }
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.token).toBeDefined();

    // 3. Authenticated Admin Games (SUPER_ADMIN)
    const adminRes = await request.get(`${BASE_URL}/api/admin/games`, {
      headers: {
        'x-admin-user-id': 'mock-super-admin-id'
      }
    });
    expect(adminRes.status()).toBe(200);
    const adminBody = await adminRes.json();
    expect(adminBody.success).toBe(true);
    expect(Array.isArray(adminBody.data)).toBe(true);

    // 4. Provably Fair Verification
    const fairnessRes = await request.get(`${BASE_URL}/api/fairness/verify?game=dice&serverSeed=abc123456&clientSeed=xyz987654&nonce=1`);
    expect(fairnessRes.status()).toBe(200);
    const fairnessBody = await fairnessRes.json();
    expect(fairnessBody.success).toBe(true);
    expect(fairnessBody.outcome).toBeDefined();
    expect(fairnessBody.hash).toBeDefined();
  });

  test('STATUS 400: Malformed, invalid or missing fields return 400 Bad Request', async ({ request }) => {
    // 1. Register with empty/invalid phone
    const badPhoneRes = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone: '' }
    });
    expect(badPhoneRes.status()).toBe(400);
    const badPhoneBody = await badPhoneRes.json();
    expect(badPhoneBody.success).toBe(false);
    expect(badPhoneBody.code).toBe('INVALID_PHONE');

    // 2. Catalog favorite missing fields
    const badFavRes = await request.post(`${BASE_URL}/api/catalog/favorite`, {
      data: { userId: '', gameId: '' }
    });
    expect(badFavRes.status()).toBe(400);
    const badFavBody = await badFavRes.json();
    expect(badFavBody.success).toBe(false);

    // 3. Wager place missing required fields
    const badWagerRes = await request.post(`${BASE_URL}/api/wager/place`, {
      headers: { 'x-user-id': 'mock-user-id' },
      data: { gameType: 'CASINO' } // missing stake, odds, market, referenceId
    });
    expect(badWagerRes.status()).toBe(400);
    const badWagerBody = await badWagerRes.json();
    expect(badWagerBody.success).toBe(false);
    expect(badWagerBody.message).toContain('Missing required fields');

    // 4. Wager settle missing status or wagerId
    const badSettleRes = await request.post(`${BASE_URL}/api/wager/settle`, {
      headers: { 'x-admin-user-id': 'mock-super-admin-id' },
      data: { wagerId: 'some-id' } // missing status
    });
    expect(badSettleRes.status()).toBe(400);
    const badSettleBody = await badSettleRes.json();
    expect(badSettleBody.success).toBe(false);
    expect(badSettleBody.message).toContain('Missing required fields');
  });

  test('STATUS 401: Missing, invalid or expired authorization headers return 401 Unauthorized', async ({ request }) => {
    // 1. Missing auth header on protected route
    const noAuthRes = await request.get(`${BASE_URL}/api/ledger`);
    expect(noAuthRes.status()).toBe(401);
    const noAuthBody = await noAuthRes.json();
    expect(noAuthBody.success).toBe(false);

    // 2. Invalid JWT token
    const invalidTokenRes = await request.get(`${BASE_URL}/api/admin/dashboard`, {
      headers: { 'Authorization': 'Bearer totally.fake.and.malformed.jwt.token' }
    });
    expect(invalidTokenRes.status()).toBe(401);
    const invalidTokenBody = await invalidTokenRes.json();
    expect(invalidTokenBody.success).toBe(false);
    expect(invalidTokenBody.code).toBe('INVALID_TOKEN');

    // 3. Protected wager placement without token or identity headers
    const unauthWagerRes = await request.post(`${BASE_URL}/api/wager/place`, {
      data: { stake: 100 }
    });
    expect(unauthWagerRes.status()).toBe(401);

    // 4. Protected admin route without token or identity headers
    const unauthAdminRes = await request.get(`${BASE_URL}/api/admin/games`);
    expect(unauthAdminRes.status()).toBe(401);
  });

  test('STATUS 403: RBAC permission violations & IDOR attempts return 403 Forbidden', async ({ request }) => {
    // 1. Regular USER role attempting to access SUPER_ADMIN endpoint (Admin Game Config)
    const forbiddenAdminRes = await request.patch(`${BASE_URL}/api/admin/games/dragon-tiger/config`, {
      headers: {
        'x-user-id': 'mock-user-id'
      },
      data: { rtp: 98.0 }
    });
    expect(forbiddenAdminRes.status()).toBe(403);
    const forbiddenBody = await forbiddenAdminRes.json();
    expect(forbiddenBody.success).toBe(false);
    expect(forbiddenBody.message).toContain('Forbidden. Requires one of: SUPER_ADMIN');

    // 2. IDOR Prevention: User attempting to modify another user balance
    const idorRes = await request.post(`${BASE_URL}/api/wallet/deduct`, {
      headers: {
        'x-user-id': 'mock-user-id'
      },
      data: {
        userId: 'victim-user-999',
        amount: 500
      }
    });
    expect(idorRes.status()).toBe(403);
    const idorBody = await idorRes.json();
    expect(idorBody.success).toBe(false);
    expect(idorBody.message).toContain('IDOR attempt blocked');
  });

  test('STATUS 404: Non-existent resources and routes return 404 Not Found', async ({ request }) => {
    // 1. Non-existent game config in Admin Games
    const notFoundGameRes = await request.get(`${BASE_URL}/api/admin/games/totally-fake-game-slug-99999`, {
      headers: {
        'x-admin-user-id': 'mock-super-admin-id'
      }
    });
    expect(notFoundGameRes.status()).toBe(404);
    const notFoundGameBody = await notFoundGameRes.json();
    expect(notFoundGameBody.success).toBe(false);
    expect(notFoundGameBody.message).toContain("not found");

    // 2. Non-existent game in catalog favorite
    const notFoundFavRes = await request.post(`${BASE_URL}/api/catalog/favorite`, {
      headers: { 'x-user-id': 'mock-user-id' },
      data: {
        userId: 'sbx-usr-normal-001',
        gameId: 'non-existent-game-uuid-404',
        isFavorite: true
      }
    });
    expect(notFoundFavRes.status()).toBe(404);
    const notFoundFavBody = await notFoundFavRes.json();
    expect(notFoundFavBody.success).toBe(false);
    expect(notFoundFavBody.message).toBe('Game not found');

    // 3. Non-existent HTTP endpoint
    const notFoundRouteRes = await request.get(`${BASE_URL}/api/v999/route-that-does-not-exist`);
    expect(notFoundRouteRes.status()).toBe(404);
  });

  test('STATUS 409: Duplicate entity collisions and state conflicts return 409 Conflict', async ({ request }) => {
    // 1. Duplicate phone registration conflict
    const testPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    
    // First registration: 201 Created
    const firstReg = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone: testPhone }
    });
    expect(firstReg.status()).toBe(201);

    // Duplicate registration attempt with exact same phone: 409 Conflict
    const dupReg = await request.post(`${BASE_URL}/api/auth/register`, {
      data: { phone: testPhone }
    });
    expect(dupReg.status()).toBe(409);
    const dupBody = await dupReg.json();
    expect(dupBody.success).toBe(false);
    expect(dupBody.code).toBe('USER_EXISTS');
    expect(dupBody.message).toContain('already registered');
  });

  test('STATUS 429: Sensitive action rate limiters enforce 429 Too Many Requests', async ({ request }) => {
    // /api/payments has strictLimiter (max 10 requests per minute)
    // We send rapid requests until 429 is triggered
    let got429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await request.post(`${BASE_URL}/api/payments/deposit/initiate`, {
        data: { amount: 500, gateway: 'MOCK_UPI' }
      });
      if (res.status() === 429) {
        got429 = true;
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.message).toContain('Rate limit exceeded');
        break;
      }
    }
    expect(got429).toBe(true);
  });

  test('STATUS 500: Server handles internal exceptions gracefully returning 500 without crashing', async ({ request }) => {
    // Settle wager with non-existent / invalid UUID wagerId triggers safe internal error catch
    const errRes = await request.post(`${BASE_URL}/api/wager/settle`, {
      headers: { 'x-admin-user-id': 'mock-super-admin-id' },
      data: {
        wagerId: '00000000-0000-0000-0000-000000000000',
        status: 'WON'
      }
    });
    expect(errRes.status()).toBe(500);
    const errBody = await errRes.json();
    expect(errBody.success).toBe(false);
    expect(errBody.message).toBeDefined();

    // Verify server remains alive and responsive immediately after 500
    const healthRes = await request.get(`${BASE_URL}/api/catalog`);
    expect(healthRes.status()).toBe(200);
  });
});

test.describe('DATABASE INTEGRITY, CONSTRAINTS & CONCURRENCY QA', () => {

  const testUserId = `qa_db_user_${Date.now()}`;
  const testPhone = `+9196${Math.floor(10000000 + Math.random() * 90000000)}`;

  test.beforeAll(async () => {
    // Seed test user with initial balance ₹1,000 (100,000 paise)
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: { id: testUserId, phone: testPhone, role: 'USER' }
    });

    await prisma.wallet.upsert({
      where: { userId_currency: { userId: testUserId, currency: 'INR' } },
      update: { balance: 100000n },
      create: { id: `wal_qa_${Date.now()}`, userId: testUserId, currency: 'INR', balance: 100000n }
    });
  });

  test.afterAll(async () => {
    // Orderly cleanup respecting foreign keys
    await prisma.ledgerTransaction.deleteMany({ where: { debitAccountId: `USER:${testUserId}` } });
    await prisma.ledgerTransaction.deleteMany({ where: { creditAccountId: `USER:${testUserId}` } });
    await prisma.transaction.deleteMany({ where: { wallet: { userId: testUserId } } });
    await prisma.wager.deleteMany({ where: { userId: testUserId } });
    await prisma.wallet.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  test('DB TRANSACTIONS: Multi-table atomic execution succeeds in a single transaction', async () => {
    const betAmountPaise = 10000n; // ₹100
    const initialWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: testUserId, currency: 'INR' } }
    });
    const balanceBefore = initialWallet.balance;

    const refId = `tx-atomic-${Date.now()}`;
    // Execute atomic placement via walletService
    await prisma.$transaction(async (tx) => {
      return await walletService.placeBet(tx, testUserId, betAmountPaise, 'CASINO', refId);
    });

    // Verify all records committed atomically:
    // 1. Wallet balance decremented
    const updatedWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: testUserId, currency: 'INR' } }
    });
    expect(updatedWallet.balance).toBe(balanceBefore - betAmountPaise);

    // 2. Ledger transaction exists
    const ledgerTx = await prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey: `bet-place-${refId}` }
    });
    expect(ledgerTx).not.toBeNull();
    expect(ledgerTx.amount).toBe(betAmountPaise);
    expect(ledgerTx.debitAccountId).toBe(`USER:${testUserId}`);
  });

  test('DB ROLLBACK: Aborted transactions revert 100% of state without partial commits', async () => {
    const walletBefore = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: testUserId, currency: 'INR' } }
    });
    const balanceBefore = walletBefore.balance;

    let errorCaught = false;
    try {
      await prisma.$transaction(async (tx) => {
        // Step 1: deduct 50,000 paise
        await tx.wallet.update({
          where: { id: walletBefore.id },
          data: { balance: balanceBefore - 50000n }
        });

        // Step 2: Simulate failure midway
        throw new Error('SIMULATED_TRANSACTION_ABORT');
      });
    } catch (err) {
      if (err.message.includes('SIMULATED_TRANSACTION_ABORT')) {
        errorCaught = true;
      }
    }

    expect(errorCaught).toBe(true);

    // Verify 100% rollback: balance is EXACTLY what it was before
    const walletAfter = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: testUserId, currency: 'INR' } }
    });
    expect(walletAfter.balance).toBe(balanceBefore);
  });

  test('DB FOREIGN KEYS: Referential integrity rejects orphaned child rows (P2003)', async () => {
    const nonExistentUserId = '00000000-0000-0000-0000-000000000000';

    // 1. Attempting to insert a Wallet for a non-existent User
    let fkErrorOnWallet = false;
    try {
      await prisma.wallet.create({
        data: {
          id: `wal_orphan_${Date.now()}`,
          userId: nonExistentUserId,
          currency: 'INR',
          balance: 50000n
        }
      });
    } catch (err) {
      // Prisma P2003 indicates foreign key constraint violation
      if (err.code === 'P2003' || err.message.includes('Foreign key constraint') || err.message.includes('foreign key')) {
        fkErrorOnWallet = true;
      }
    }
    expect(fkErrorOnWallet).toBe(true);

    // 2. Attempting to insert a Transaction for a non-existent Wallet
    let fkErrorOnTransaction = false;
    try {
      await prisma.transaction.create({
        data: {
          walletId: '00000000-0000-0000-0000-000000000000',
          idempotencyKey: `idemp-orphan-${Date.now()}`,
          type: 'DEPOSIT',
          amount: 1000n,
          balanceAfter: 1000n
        }
      });
    } catch (err) {
      if (err.code === 'P2003' || err.message.includes('Foreign key constraint') || err.message.includes('foreign key')) {
        fkErrorOnTransaction = true;
      }
    }
    expect(fkErrorOnTransaction).toBe(true);
  });

  test('DB UNIQUE CONSTRAINTS: Prevents duplicate records across unique keys (P2002)', async () => {
    // 1. Unique User.phone constraint
    const duplicatePhone = `+9195${Math.floor(10000000 + Math.random() * 90000000)}`;
    await prisma.user.create({
      data: { phone: duplicatePhone, role: 'USER' }
    });

    let duplicatePhoneRejected = false;
    try {
      await prisma.user.create({
        data: { phone: duplicatePhone, role: 'USER' }
      });
    } catch (err) {
      // Prisma P2002 indicates unique constraint violation
      if (err.code === 'P2002' || err.message.includes('Unique constraint') || err.message.includes('unique')) {
        duplicatePhoneRejected = true;
      }
    }
    expect(duplicatePhoneRejected).toBe(true);

    // 2. Compound Unique Wallet [userId, currency] constraint
    let duplicateCompoundRejected = false;
    try {
      await prisma.wallet.create({
        data: {
          id: `wal_dup_${Date.now()}`,
          userId: testUserId,
          currency: 'INR', // already exists for testUserId
          balance: 1000n
        }
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint') || err.message.includes('unique')) {
        duplicateCompoundRejected = true;
      }
    }
    expect(duplicateCompoundRejected).toBe(true);

    // 3. Unique Transaction.idempotencyKey constraint
    const uniqueKey = `idemp_unique_key_${Date.now()}`;
    const userWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: testUserId, currency: 'INR' } }
    });

    await prisma.transaction.create({
      data: {
        walletId: userWallet.id,
        idempotencyKey: uniqueKey,
        type: 'BET_PLACE',
        amount: 1000n,
        balanceAfter: userWallet.balance
      }
    });

    let duplicateIdempRejected = false;
    try {
      await prisma.transaction.create({
        data: {
          walletId: userWallet.id,
          idempotencyKey: uniqueKey, // exact duplicate key
          type: 'BET_PLACE',
          amount: 1000n,
          balanceAfter: userWallet.balance
        }
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint') || err.message.includes('unique')) {
        duplicateIdempRejected = true;
      }
    }
    expect(duplicateIdempRejected).toBe(true);
  });

  test('DB RACE CONDITIONS: Row-level locking prevents double-spending on concurrent bets', async () => {
    // Setup user with exact ₹200 (20,000 paise)
    const raceUser = `qa_race_user_${Date.now()}`;
    await prisma.user.create({
      data: { id: raceUser, phone: `+9194${Math.floor(10000000 + Math.random() * 90000000)}` }
    });
    await prisma.wallet.create({
      data: { id: `wal_race_${Date.now()}`, userId: raceUser, currency: 'INR', balance: 20000n }
    });

    // Fire 10 simultaneous parallel bets of ₹100 (10,000 paise) each
    // Exactly 2 must succeed (20,000 / 10,000 = 2), and 8 must fail
    const concurrentRequests = [];
    for (let i = 0; i < 10; i++) {
      concurrentRequests.push(
        wagerService.placeWager({
          userId: raceUser,
          gameType: 'CASINO',
          referenceId: `race-test-${Date.now()}-${i}`,
          market: 'RACE_TEST',
          selection: 'Red',
          type: 'BACK',
          stake: 100, // ₹100
          clientOdds: 2.0
        }).catch(err => ({ error: err.message }))
      );
    }

    const results = await Promise.all(concurrentRequests);
    const successes = results.filter(r => r.status === 'ACCEPTED').length;
    const failures = results.filter(r => r.error).length;

    const finalWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: raceUser, currency: 'INR' } }
    });

    expect(successes).toBe(2);
    expect(failures).toBe(8);
    expect(finalWallet.balance).toBe(0n); // Perfectly zero, never negative

    // Cleanup race user
    await prisma.ledgerTransaction.deleteMany({ where: { debitAccountId: `USER:${raceUser}` } });
    await prisma.transaction.deleteMany({ where: { wallet: { userId: raceUser } } });
    await prisma.wager.deleteMany({ where: { userId: raceUser } });
    await prisma.wallet.deleteMany({ where: { userId: raceUser } });
    await prisma.user.deleteMany({ where: { id: raceUser } });
  });

  test('DB DUPLICATE REQUESTS: Idempotency keys prevent double charge on re-sent requests', async () => {
    const dupUser = `qa_idemp_user_${Date.now()}`;
    await prisma.user.create({
      data: { id: dupUser, phone: `+9193${Math.floor(10000000 + Math.random() * 90000000)}` }
    });
    await prisma.wallet.create({
      data: { id: `wal_idemp_${Date.now()}`, userId: dupUser, currency: 'INR', balance: 50000n } // ₹500
    });

    const fixedRefId = `unique-bet-round-uuid-${Date.now()}`;

    // Request 1: Succeeds
    const firstPlace = await prisma.$transaction(async (tx) => {
      return await walletService.placeBet(tx, dupUser, 10000n, 'CASINO', fixedRefId);
    });
    expect(firstPlace).toBe(40000n); // ₹400 remaining

    // Request 2 (Identical re-send): Must fail on idempotency key constraint
    let duplicateBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        return await walletService.placeBet(tx, dupUser, 10000n, 'CASINO', fixedRefId);
      });
    } catch (err) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint') || err.message.includes('idempotencyKey')) {
        duplicateBlocked = true;
      }
    }
    expect(duplicateBlocked).toBe(true);

    // Balance remains ₹400 (only charged once, not twice!)
    const finalWallet = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: dupUser, currency: 'INR' } }
    });
    expect(finalWallet.balance).toBe(40000n);

    // Cleanup
    await prisma.ledgerTransaction.deleteMany({ where: { referenceId: fixedRefId } });
    await prisma.transaction.deleteMany({ where: { reference: fixedRefId } });
    await prisma.wallet.deleteMany({ where: { userId: dupUser } });
    await prisma.user.deleteMany({ where: { id: dupUser } });
  });

});
