const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const wagerService = require('./src/services/wagerService');

async function testWagerEngine() {
  console.log("=== Testing Wager & Settlement Engine ===");

  // Setup: Find or create a user for testing
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: { phone: "TEST" + Date.now() }
    });
    await prisma.wallet.create({ data: { userId: user.id, balance: 100000n, currency: 'INR' } });
    await prisma.ledgerAccount.create({ data: { id: `USER:${user.id}`, type: 'USER' } });
  }

  // 1. Test Stale Odds Rejection
  console.log("\n[Test 1] Stale Odds Rejection");
  try {
    await wagerService.placeWager({
      userId: user.id,
      gameType: 'SPORTS',
      referenceId: 'mock-evt-1',
      market: 'Match Winner',
      selection: 'India',
      type: 'BACK',
      stake: 100, // 100 INR
      clientOdds: 1.42 // Provider has 1.45, so 1.42 triggers Stale Odds
    });
    console.error("❌ FAILED: Stale odds were accepted!");
  } catch (e) {
    if (e.message.includes('Stale Odds')) {
      console.log("✅ PASSED: Stale odds correctly rejected.");
    } else {
      console.error("❌ FAILED: Unexpected error", e);
    }
  }

  // 2. Test Successful Wager & Settlement (WON)
  console.log("\n[Test 2] Successful Wager Placement and WIN Settlement");
  try {
    const betResult = await wagerService.placeWager({
      userId: user.id,
      gameType: 'SPORTS',
      referenceId: 'mock-evt-1',
      market: 'Match Winner',
      selection: 'India',
      type: 'BACK',
      stake: 100, // 100 INR
      clientOdds: 1.45 // Valid odds
    });
    console.log("✅ Wager placed successfully:", betResult.wagerId);

    const settleResult = await wagerService.settleWager(betResult.wagerId, 'WON');
    console.log("✅ Wager settled as WON:", settleResult.status);
    
    // 3. Test Duplicate Settlement (Idempotency / State Check)
    console.log("\n[Test 3] Duplicate Settlement Prevention");
    try {
      await wagerService.settleWager(betResult.wagerId, 'WON');
      console.error("❌ FAILED: Duplicate settlement allowed!");
    } catch (e) {
      if (e.message.includes('already settled')) {
        console.log("✅ PASSED: Duplicate settlement blocked.");
      } else {
        console.error("❌ FAILED: Unexpected error", e);
      }
    }
  } catch (e) {
    console.error("❌ FAILED:", e);
  }

  console.log("\n=== Testing Complete ===");
  process.exit(0);
}

testWagerEngine();
