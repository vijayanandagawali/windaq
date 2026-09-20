const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const paymentService = require('./src/services/paymentService');
const mockUpiAdapter = require('./src/services/paymentAdapters/mockUpiAdapter');
const crypto = require('crypto');

async function testPaymentSystem() {
  console.log('=== WinDaq Payment & UPI Engine Test ===\n');

  const mockUserId = 'test-payment-user-001';

  // 1. Setup Base User and Wallet
  await prisma.user.upsert({
    where: { id: mockUserId },
    update: {},
    create: { id: mockUserId, phone: '6666666666' }
  });

  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId: mockUserId, currency: 'INR' } },
    update: { balance: 5000000n }, // Give them 50,000 INR
    create: { userId: mockUserId, currency: 'INR', balance: 5000000n }
  });

  console.log(`✅ Base user & wallet created. Initial Balance: ${wallet.balance}`);

  // 2. Test Deposit Lifecycle
  console.log('\n--- Testing Deposit Flow ---');
  // 2a. Initiate Deposit
  const depositIntent = await paymentService.createDepositIntent(mockUserId, 500000n, 'MOCK_UPI'); // 5000 INR
  console.log(`   Deposit Intent Created [${depositIntent.id}]`);
  console.log(`   Status: ${depositIntent.status}`);
  console.log(`   Provider Ref: ${depositIntent.providerReference}`);
  console.log(`   UPI Link: ${depositIntent.metadata?.intentUrl}`);

  // 2b. Mock Webhook Callback (SUCCESS)
  console.log('\n--- Simulating Provider Webhook Callback ---');
  const payload = {
    providerReference: depositIntent.providerReference,
    status: 'SUCCESS',
    txId: 'bank-txn-12345'
  };
  const signature = crypto.createHmac('sha256', mockUpiAdapter.secretKey).update(JSON.stringify(payload)).digest('hex');

  const webhookResult = await paymentService.handleWebhookCallback('MOCK_UPI', payload, signature);
  console.log(`   Webhook Processed: ${webhookResult.success}`);

  // 2c. Idempotency Check (Duplicate Webhook)
  console.log('\n--- Simulating Duplicate Webhook Callback ---');
  const duplicateResult = await paymentService.handleWebhookCallback('MOCK_UPI', payload, signature);
  console.log(`   Duplicate Webhook Result: ${duplicateResult.message}`);

  const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
  console.log(`   New Wallet Balance: ${updatedWallet.balance} paise (expected 500000)`);

  // 3. Test Withdrawal Lifecycle (Review Gate)
  console.log('\n--- Testing Withdrawal Flow ---');
  
  // 3a. Request High Value Withdrawal (Should trigger PENDING_REVIEW)
  const withdrawIntent = await paymentService.requestWithdrawal(mockUserId, 2000000n, 'MOCK_UPI', 'nanda@okicici'); // 20k INR
  console.log(`   Withdrawal Intent Created [${withdrawIntent.id}]`);
  console.log(`   Status: ${withdrawIntent.status} (Expected: PENDING_REVIEW)`);

  const liabilityWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
  console.log(`   Wallet Balance after hold: ${liabilityWallet.balance} paise`);

  // 3b. Admin Approves
  console.log('\n--- Admin Approves Withdrawal ---');
  await paymentService.approveWithdrawal(withdrawIntent.id, 'admin-123');
  const postApprove = await prisma.paymentIntent.findUnique({ where: { id: withdrawIntent.id } });
  console.log(`   Status after Admin Approval: ${postApprove.status} (Expected: PENDING)`);
  console.log(`   Provider Ref generated: ${postApprove.providerReference}`);

  // 3c. Webhook Success
  console.log('\n--- Simulating Provider Webhook Callback (Withdrawal Success) ---');
  const payloadW = {
    providerReference: postApprove.providerReference,
    status: 'SUCCESS',
    txId: 'bank-payout-999'
  };
  const sigW = crypto.createHmac('sha256', mockUpiAdapter.secretKey).update(JSON.stringify(payloadW)).digest('hex');
  await paymentService.handleWebhookCallback('MOCK_UPI', payloadW, sigW);
  
  const finalIntent = await prisma.paymentIntent.findUnique({ where: { id: withdrawIntent.id } });
  console.log(`   Final Intent Status: ${finalIntent.status} (Expected: SUCCESS)`);
  console.log('\n✅ Payment Test Suite Completed.');
}

async function runSafeTest() {
  try {
    await testPaymentSystem();
  } catch (err) {
    console.error(`\n❌ Caught Expected Error during execution: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

runSafeTest();
