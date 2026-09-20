const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const complianceService = require('./src/services/complianceService');

async function testComplianceSystem() {
  console.log('=== WinDaq KYC & Responsible Gaming Test ===\n');

  const mockUserId = 'test-compliance-user-001';

  // 0. Pre-cleanup to ensure clean test state
  await prisma.selfExclusion.deleteMany({ where: { userId: mockUserId } });
  await prisma.responsibleGamingLimits.deleteMany({ where: { userId: mockUserId } });

  // 1. Setup Base User
  await prisma.user.upsert({
    where: { id: mockUserId },
    update: {},
    create: { id: mockUserId, phone: '7777777777' }
  });

  // 2. Setup Jurisdiction Config
  await prisma.jurisdictionConfig.upsert({
    where: { id: 'IN-MH' },
    update: { allowCasino: false, allowSports: true },
    create: { id: 'IN-MH', allowCasino: false, allowSports: true }
  });
  console.log('✅ Jurisdiction Config created: IN-MH (Casino: Blocked, Sports: Allowed)');

  // 3. Test KYC Encryption & Jurisdiction Blocking
  console.log('\n--- Testing KYC Encryption & Jurisdiction Gate ---');
  await complianceService.submitKyc(mockUserId, 'IN-MH', '1990-01-01', 'mock_passport_s3_url_or_base64');
  console.log('   KYC submitted. Document payload encrypted using AES-256.');

  try {
    await complianceService.checkEligibility(mockUserId, 'CASINO', 5000n);
    console.log('❌ FAILED: Jurisdiction block bypassed.');
  } catch (err) {
    console.log(`🚩 Intercepted successfully: ${err.message}`);
  }

  try {
    await complianceService.checkEligibility(mockUserId, 'SPORTS', 5000n);
    console.log('✅ SPORTS wager permitted by Jurisdiction rules.');
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
  }

  // 4. Test Wager Limits
  console.log('\n--- Testing Daily Wager Limits ---');
  await prisma.responsibleGamingLimits.upsert({
    where: { userId: mockUserId },
    update: { dailyWagerLimit: 100000n }, // 1000 INR
    create: { userId: mockUserId, dailyWagerLimit: 100000n }
  });

  try {
    await complianceService.checkEligibility(mockUserId, 'SPORTS', 150000n); // 1500 INR
    console.log('❌ FAILED: Limit block bypassed.');
  } catch (err) {
    console.log(`🚩 Intercepted successfully: ${err.message}`);
  }

  // 5. Test Self-Exclusion
  console.log('\n--- Testing Self-Exclusion ---');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  await prisma.selfExclusion.create({
    data: { userId: mockUserId, exclusionEndDate: futureDate, reason: 'Cool-Off' }
  });

  try {
    // Should fail even though jurisdiction and limits are technically fine for small amounts
    await complianceService.checkEligibility(mockUserId, 'SPORTS', 100n);
    console.log('❌ FAILED: Self-Exclusion bypassed.');
  } catch (err) {
    console.log(`🚩 Intercepted successfully: ${err.message}`);
  }

  console.log('\n✅ Compliance & Responsible Gaming Test Suite Completed.');
}

testComplianceSystem().catch(console.error).finally(() => prisma.$disconnect());
