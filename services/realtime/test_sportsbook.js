const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const wagerService = require('./src/services/wagerService');
const mockProvider = require('./src/services/sports/MockSportsProvider');

async function testSportsbookEngine() {
  console.log("=== Testing Sportsbook Complete Engine ===");

  // Setup: Find or create a user for testing
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({ data: { phone: "TESTSPORTS" + Date.now() } });
    await prisma.wallet.create({ data: { userId: user.id, balance: 500000n, currency: 'INR' } });
    await prisma.ledgerAccount.create({ data: { id: `USER:${user.id}`, type: 'USER' } });
  }

  // 1. Base Acceptance
  console.log("\n[Test 1] Successful Bet Acceptance (No Suspension, Correct Odds)");
  try {
    const bet1 = await wagerService.placeWager({
      userId: user.id,
      gameType: 'SPORTS',
      referenceId: 'mock-evt-1',
      market: 'Match Winner',
      selection: 'India',
      type: 'BACK',
      stake: 100,
      clientOdds: 1.45 // Exact match
    });
    console.log("✅ PASSED: Wager accepted", bet1.wagerId);

    // Verify Market Config snapshot
    const wagerRec = await prisma.wager.findUnique({ where: { id: bet1.wagerId } });
    if (wagerRec.marketConfig && wagerRec.marketConfig.marketId === 'mock-mkt-1') {
      console.log("✅ PASSED: Market configuration snapshot persisted.");
    } else {
      console.error("❌ FAILED: Market configuration snapshot missing or incorrect.");
    }
  } catch (e) {
    console.error("❌ FAILED:", e.message);
  }

  // 2. Admin Suspend Market -> Rejection
  console.log("\n[Test 2] Admin Market Suspension Check");
  mockProvider.simulateSuspension('mock-evt-1', 'mock-mkt-1');
  try {
    await wagerService.placeWager({
      userId: user.id,
      gameType: 'SPORTS',
      referenceId: 'mock-evt-1',
      market: 'Match Winner',
      selection: 'India',
      type: 'BACK',
      stake: 100,
      clientOdds: 1.45
    });
    console.error("❌ FAILED: Bet was accepted on a suspended market!");
  } catch (e) {
    if (e.message.includes('Suspended')) {
      console.log("✅ PASSED: Market suspension blocked the bet.");
    } else {
      console.error("❌ FAILED: Unexpected error:", e.message);
    }
  }

  // 3. Admin Odds Change -> Stale Odds Rejection
  console.log("\n[Test 3] Provider Odds Change (Stale Odds Check)");
  // Resume market, but change odds to 1.40
  const event = mockProvider.mockEvents[0];
  event.markets[0].status = 'ACTIVE';
  mockProvider.simulateOddsChange('mock-evt-1', 'sel-ind', 1.40);

  try {
    await wagerService.placeWager({
      userId: user.id,
      gameType: 'SPORTS',
      referenceId: 'mock-evt-1',
      market: 'Match Winner',
      selection: 'India',
      type: 'BACK',
      stake: 100,
      clientOdds: 1.45 // Client still trying to use old odds
    });
    console.error("❌ FAILED: Stale odds were accepted!");
  } catch (e) {
    if (e.message.includes('Stale Odds')) {
      console.log(`✅ PASSED: Stale odds blocked. (${e.message})`);
    } else {
      console.error("❌ FAILED: Unexpected error:", e.message);
    }
  }

  // 4. Max Liability/Payout Limits
  console.log("\n[Test 4] Max Payout Limit Protection");
  try {
    await wagerService.placeWager({
      userId: user.id,
      gameType: 'SPORTS',
      referenceId: 'mock-evt-1',
      market: 'Match Winner',
      selection: 'India',
      type: 'BACK',
      stake: 1000000, // 10 Lakhs * 1.4 = 14 Lakh payout (Exceeds 10L limit)
      clientOdds: 1.40
    });
    console.error("❌ FAILED: Max payout limit bypassed!");
  } catch (e) {
    if (e.message.includes('Max Payout Exceeded')) {
      console.log("✅ PASSED: Max payout limit successfully blocked the massive bet.");
    } else {
      console.error("❌ FAILED: Unexpected error:", e.message);
    }
  }

  console.log("\n=== Testing Complete ===");
  process.exit(0);
}

testSportsbookEngine();
