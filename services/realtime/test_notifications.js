const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationService = require('./src/services/notificationService');

async function testNotifications() {
  console.log('=== WinDaq Notifications Engine Test ===\n');

  const mockUserId = 'test-notif-user-001';

  // 1. Setup Base User and Preferences
  await prisma.user.upsert({
    where: { id: mockUserId },
    update: {},
    create: { id: mockUserId, phone: '7777777799' }
  });

  // Opt out of Marketing SMS, but keep Email
  await prisma.notificationPreference.upsert({
    where: { userId: mockUserId },
    update: { marketingSms: false, marketingEmail: true },
    create: { userId: mockUserId, marketingSms: false, marketingEmail: true }
  });
  console.log('✅ Created User and opted OUT of Marketing SMS, opted IN to Marketing Email.');

  // 2. Test Transactional (OTP) - Should bypass opt-outs
  console.log('\n--- Testing Transactional (OTP) Notification ---');
  const otpLogs = await notificationService.dispatch(
    mockUserId,
    'OTP_LOGIN',
    { otp: '123456' },
    ['SMS'],
    true // isTransactional = true
  );
  
  const otpLog = await prisma.notificationLog.findUnique({ where: { id: otpLogs[0].id } });
  console.log(`   OTP Log Status: ${otpLog.status}`);
  console.log(`   Safe Payload Check (Should be redacted):`);
  console.log(otpLog.providerResponse.safeVariables);
  if (otpLog.providerResponse.safeVariables.otp === '***REDACTED***') {
    console.log(`   ✅ SUCCESS: OTP was properly redacted from logs!`);
  } else {
    console.log(`   ❌ FAILED: OTP leaked into logs!`);
  }

  // 3. Test Marketing Promotion - Should respect opt-outs
  console.log('\n--- Testing Marketing Preference Rules ---');
  const promoLogs = await notificationService.dispatch(
    mockUserId,
    'PROMO_ALERT',
    { bonusName: 'Welcome 500' },
    ['SMS', 'EMAIL'],
    false // isTransactional = false
  );
  
  // We only expect 1 log (for Email) because SMS was skipped entirely before reaching the adapter.
  if (promoLogs.length === 1 && promoLogs[0].channel === 'EMAIL') {
    console.log(`   ✅ SUCCESS: SMS was skipped based on user preference. Email was sent.`);
  } else {
    console.log(`   ❌ FAILED: Expected 1 EMAIL log, got ${promoLogs.length} logs.`);
  }

  // 4. Test In-App Delivery
  console.log('\n--- Testing In-App Delivery ---');
  const inAppLogs = await notificationService.dispatch(
    mockUserId,
    'DEPOSIT_SUCCESS',
    { amount: '5,000' },
    ['IN_APP'],
    true
  );
  console.log(`   In-App Log Status: ${inAppLogs[0].status}`);

  console.log('\n✅ Notifications Test Suite Completed.');
}

testNotifications().catch(console.error).finally(() => prisma.$disconnect());
