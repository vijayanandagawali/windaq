require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const wagerService = require('./src/services/wagerService');
const walletService = require('./src/services/walletService');

async function runConcurrencyTests() {
  console.log('=== WinDaq QA: Concurrency & Stress Tests ===\n');
  const testUserId = 'qa-stress-user-001';

  // 1. Setup User with exact balance (e.g., 500 INR = 50,000 paise)
  await prisma.user.upsert({
    where: { id: testUserId },
    update: {},
    create: { id: testUserId, phone: '9999999901' }
  });

  await prisma.wallet.upsert({
    where: { userId_currency: { userId: testUserId, currency: 'INR' } },
    update: { balance: 50000n },
    create: { userId: testUserId, balance: 50000n, currency: 'INR' }
  });

  console.log(`✅ Test User setup with balance: ₹500 (50,000 paise)`);

  // ---------------------------------------------------------
  // TEST 1: Double Spend Prevention (Wager Placement)
  // ---------------------------------------------------------
  console.log('\n--- [TEST 1] Wager Double-Spend (Concurrent Requests) ---');
  console.log('Action: Firing 10 simultaneous requests to place a ₹100 bet.');
  console.log('Expectation: Exactly 5 should succeed (₹500 / ₹100), 5 should fail.');

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      wagerService.placeWager({
        userId: testUserId,
        gameType: 'CASINO',
        referenceId: `qa-test-${Date.now()}-${i}`,
        market: 'QA_TEST',
        selection: 'Red',
        type: 'BACK',
        stake: 100, // 100 INR = 10,000 paise
        clientOdds: 2.0
      }).catch(err => ({ error: err.message }))
    );
  }

  const results = await Promise.all(promises);
  const successes = results.filter(r => r.status === 'ACCEPTED').length;
  const failures = results.filter(r => r.error).length;

  const finalWallet1 = await prisma.wallet.findUnique({ where: { userId_currency: { userId: testUserId, currency: 'INR' } } });

  console.log(`Results: ${successes} Success, ${failures} Failures.`);
  if (successes === 5 && finalWallet1.balance === 0n) {
    console.log(`✅ PASS: Database locks successfully prevented double-spending.`);
  } else {
    console.error(`❌ FAIL: Expected 5 successes, got ${successes}. Final balance: ${finalWallet1.balance}`);
  }

  // ---------------------------------------------------------
  // TEST 2: Double Settlement (Concurrent Webhooks)
  // ---------------------------------------------------------
  console.log('\n--- [TEST 2] Settlement Double-Payout (Concurrent Webhooks) ---');
  // Get one of the pending wagers
  const pendingWager = await prisma.wager.findFirst({
    where: { userId: testUserId, status: 'PENDING' }
  });

  if (!pendingWager) {
    console.log('❌ Skipped: No pending wager found to settle.');
  } else {
    console.log(`Action: Simulating 3 concurrent callbacks claiming a WIN on Wager ${pendingWager.id}`);
    console.log(`Expectation: Exactly 1 settles. Balance increases by ₹200 (100 stake * 2.0 odds).`);

    const settlePromises = [];
    for (let i = 0; i < 3; i++) {
      settlePromises.push(
        wagerService.settleWager(pendingWager.id, 'WON')
          .catch(err => ({ error: err.message }))
      );
    }

    const settleResults = await Promise.all(settlePromises);
    const settleSuccess = settleResults.filter(r => r.id === pendingWager.id).length;
    const settleFails = settleResults.filter(r => r.error).length;

    const finalWallet2 = await prisma.wallet.findUnique({ where: { userId_currency: { userId: testUserId, currency: 'INR' } } });

    console.log(`Results: ${settleSuccess} Settlement Succeeded, ${settleFails} Failed.`);
    if (settleSuccess === 1 && finalWallet2.balance === 20000n) {
      console.log(`✅ PASS: Settlement is perfectly idempotent. No double payouts.`);
    } else {
      console.error(`❌ FAIL: Expected 1 success, got ${settleSuccess}. Final balance: ${finalWallet2.balance}`);
    }
  }

  console.log('\n✅ Concurrency Matrix tests completed.');
}

runConcurrencyTests().catch(console.error).finally(() => prisma.$disconnect());
