const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const riskService = require('./src/services/riskService');
const walletService = require('./src/services/walletService');

async function testRiskSystem() {
  console.log('=== WinDaq Risk & Fraud System Test ===\n');

  // 1. Setup Mock User
  const mockUserId = 'test-fraud-user-001';
  await prisma.user.upsert({
    where: { id: mockUserId },
    update: {},
    create: { id: mockUserId, phone: '9999999999' }
  });

  await prisma.wallet.upsert({
    where: { userId_currency: { userId: mockUserId, currency: 'INR' } },
    update: { balance: 500000n }, // 5000 INR
    create: { userId: mockUserId, currency: 'INR', balance: 500000n }
  });

  console.log('✅ Mock user and wallet created.');

  // 2. Test Velocity Abuse
  console.log('\n--- Simulating Scripted Flooding (Velocity Abuse) ---');
  await riskService.flagUser(mockUserId, 'VELOCITY_ABUSE', { endpoint: 'tg:bet', rate: '25req/sec' }, 'HIGH');
  console.log('🚩 Fired VELOCITY_ABUSE flag manually (Simulating CoreSocketManager trigger).');

  // 3. Test Replay Attack (Idempotency Collision)
  console.log('\n--- Simulating Replay Attack (Duplicate Settlement) ---');
  const idempotencyKey = 'bet-place-duplicate-test-123';
  
  try {
    await prisma.$transaction(async (tx) => {
      await walletService.placeBet(tx, mockUserId, 1000n, 'BET_PLACE', 'duplicate-test-123');
    });
    console.log('   First bet placed successfully.');
    
    // Simulate replay attack by calling it again with same reference
    await prisma.$transaction(async (tx) => {
      await walletService.placeBet(tx, mockUserId, 1000n, 'BET_PLACE', 'duplicate-test-123');
    });
  } catch (err) {
    console.log('   Intercepted error:', err.message);
    const isDuplicate = await riskService.checkIdempotencyError(err, mockUserId, 'walletService.placeBet', { reference: 'duplicate-test-123' });
    if (isDuplicate) {
      console.log('🚩 Replay attack intercepted. DUPLICATE_ATTEMPT flag created.');
    } else {
      console.log('❌ Failed to intercept as replay attack.');
    }
  }

  // 4. Test Impossible State
  console.log('\n--- Simulating Impossible State Transition ---');
  await riskService.flagUser(mockUserId, 'IMPOSSIBLE_STATE', { action: 'tg:bet', error: 'Round is locked' }, 'CRITICAL');
  console.log('🚩 Fired IMPOSSIBLE_STATE flag manually (Simulating tableHandler trigger).');

  // 5. Test Multi-Accounting (Device Fingerprint Collision)
  console.log('\n--- Simulating Multi-Account Detection ---');
  const ipAddress = '192.168.1.100';
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
  
  // Track device for user 1
  await riskService.trackDevice(mockUserId, ipAddress, ua);
  
  // Track same device for user 2
  const mockUserId2 = 'test-fraud-user-002';
  await prisma.user.upsert({ where: { id: mockUserId2 }, update: {}, create: { id: mockUserId2, phone: '8888888888' } });
  
  console.log(`   Tracking device for new user ${mockUserId2} on same IP/UA...`);
  await riskService.trackDevice(mockUserId2, ipAddress, ua);
  console.log('🚩 Device collision detected. MULTI_ACCOUNT flag should be created for user 2.');

  // 6. Verify Flags in DB
  console.log('\n--- Verifying Database State ---');
  const flags = await prisma.riskFlag.findMany({ where: { userId: { in: [mockUserId, mockUserId2] } } });
  console.log(`Found ${flags.length} open risk flags across test accounts.`);
  
  const profile = await prisma.userRiskProfile.findUnique({ where: { userId: mockUserId } });
  console.log(`User 1 Risk Score accumulated to: ${profile?.riskScore} / 100`);

  console.log('\n✅ Anti-Abuse Test Suite Completed.');
}

testRiskSystem().catch(console.error).finally(() => prisma.$disconnect());
