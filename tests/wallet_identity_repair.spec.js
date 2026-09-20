const { test, expect } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('../services/realtime/src/services/walletService');
const complianceService = require('../services/realtime/src/services/complianceService');

test.describe('Wallet Identity Repair Test Suite', () => {

  test('Flow Test: AUTH USER -> FIND USER -> FIND WALLET -> IF MISSING CREATE WALLET -> RETURN WALLET', async () => {
    const testUserId = `test_flow_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    console.log(`Executing identity & wallet resolution flow for: ${testUserId}`);

    // 1. Initial State: User and Wallet do not exist in DB
    const preUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(preUser).toBeNull();

    // 2. Execute Universal Resolver Flow
    const result = await walletService.getOrCreateUserAndWallet(prisma, testUserId, {
      initialPaise: 500000n // ₹5,000
    });

    // 3. Verify Return Values
    expect(result).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.id).toBe(testUserId);
    expect(result.wallet).toBeDefined();
    expect(result.wallet.userId).toBe(testUserId);
    expect(result.wallet.currency).toBe('INR');
    expect(result.wallet.balance).toBe(500000n);
    expect(result.ledgerAccount).toBeDefined();
    expect(result.ledgerAccount.id).toBe(`USER:${testUserId}`);

    console.log(`✓ Flow successfully provisioned User (${result.user.id}), Wallet (₹${Number(result.wallet.balance)/100}), and LedgerAccount`);

    // 4. Repeated Call (Idempotency): Should return existing wallet without creating duplicate
    const secondCall = await walletService.getOrCreateUserAndWallet(prisma, testUserId);
    expect(secondCall.wallet.id).toBe(result.wallet.id);
    expect(secondCall.wallet.balance).toBe(500000n); // Balance preserved
    console.log('✓ Idempotency verified: re-query returned exact same wallet ID without modifying balance');
  });

  test('Concurrency & Unique Constraint Test: Zero duplicate wallets created under 10 parallel requests', async () => {
    const concurrentUserId = `concurrent_usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`Executing concurrency test: 10 parallel creations for ${concurrentUserId}`);

    // Fire 10 simultaneous calls for the exact same user ID
    const promises = Array.from({ length: 10 }).map(() =>
      walletService.getOrCreateUserAndWallet(prisma, concurrentUserId, { initialPaise: 1000000n })
    );

    const results = await Promise.all(promises);

    // Verify all 10 resolved successfully
    expect(results).toHaveLength(10);
    for (const res of results) {
      expect(res.wallet).toBeDefined();
      expect(res.wallet.userId).toBe(concurrentUserId);
    }

    // Verify at database level: EXACTLY 1 wallet exists
    const dbWallets = await prisma.wallet.findMany({
      where: { userId: concurrentUserId, currency: 'INR' }
    });

    console.log(`Database count of wallets for ${concurrentUserId}: ${dbWallets.length}`);
    expect(dbWallets.length).toBe(1);
    console.log('✓ CRITICAL PASS: Zero duplicate wallets! Database unique constraint and atomic upsert successfully preserved single wallet invariant.');
  });

  test('Elimination of "Wallet not found" in Bet & Settlement operations', async () => {
    const betUserId = `bet_repair_usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const betAmountPaise = 20000n; // ₹200
    const winAmountPaise = 40000n; // ₹400

    // 1. placeBet on brand new user (never provisioned before)
    console.log('Testing placeBet on unprovisioned user...');
    const balanceAfterBet = await prisma.$transaction(async (tx) => {
      return await walletService.placeBet(tx, betUserId, betAmountPaise, 'TEST_BET', `ref_${Date.now()}`);
    });

    expect(balanceAfterBet).toBeDefined();
    // Default initial was 1,000,000n (₹10,000), minus 20,000n = 980,000n
    expect(balanceAfterBet).toBe(980000n);
    console.log(`✓ placeBet auto-healed wallet and placed bet cleanly. Balance after bet: ₹${Number(balanceAfterBet)/100}`);

    // 2. settleWin on the user
    console.log('Testing settleWin...');
    const balanceAfterWin = await prisma.$transaction(async (tx) => {
      return await walletService.settleWin(tx, betUserId, betAmountPaise, winAmountPaise, 'TEST_WIN', `ref_win_${Date.now()}`);
    });

    expect(balanceAfterWin).toBe(980000n + winAmountPaise); // 1,020,000n
    console.log(`✓ settleWin credited winnings cleanly without "Wallet not found". Balance: ₹${Number(balanceAfterWin)/100}`);

    // 3. refundBet on the user
    console.log('Testing refundBet...');
    const balanceAfterRefund = await prisma.$transaction(async (tx) => {
      return await walletService.refundBet(tx, betUserId, 5000n, 'TEST_REFUND', `ref_ref_${Date.now()}`);
    });

    expect(balanceAfterRefund).toBe(balanceAfterWin + 5000n);
    console.log(`✓ refundBet executed cleanly without "Wallet not found". Final Balance: ₹${Number(balanceAfterRefund)/100}`);
  });

  test('Elimination of "User not found" in Compliance checkEligibility', async () => {
    const complianceUserId = `comp_usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`Testing complianceService.checkEligibility on unprovisioned user: ${complianceUserId}`);

    // Pre-check: user does not exist
    const exists = await prisma.user.findUnique({ where: { id: complianceUserId } });
    expect(exists).toBeNull();

    // Call checkEligibility
    const eligible = await complianceService.checkEligibility(complianceUserId, 'CASINO', 5000n);
    expect(eligible).toBe(true);

    // Verify user was auto-provisioned
    const postUser = await prisma.user.findUnique({ where: { id: complianceUserId } });
    expect(postUser).toBeDefined();
    expect(postUser.id).toBe(complianceUserId);
    console.log('✓ CRITICAL PASS: Compliance check auto-provisioned missing user instead of throwing "User not found"');
  });

  test('REST API Balance Endpoint Auto-Healing Test (/api/ledger/balance)', async ({ request }) => {
    const apiUserId = `api_usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    console.log(`Testing GET /api/ledger/balance with new x-user-id: ${apiUserId}`);

    const res = await request.get('http://localhost:4000/api/ledger/balance', {
      headers: {
        'x-user-id': apiUserId
      }
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.balance).toBe('number');
    expect(data.balance).toBeGreaterThanOrEqual(100); // Has playable balance
    console.log(`✓ /api/ledger/balance returned success=true, balance=₹${data.balance} without 404 or "Wallet not found"`);
  });

});
