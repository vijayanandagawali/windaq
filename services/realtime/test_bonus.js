const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bonusService = require('./src/services/bonusService');

async function testBonusSystem() {
  console.log('=== WinDaq Bonus & Promotion Engine Test ===\n');

  const mockUserId = 'test-bonus-user-001';

  // 1. Setup Base User and Wallet
  await prisma.user.upsert({
    where: { id: mockUserId },
    update: {},
    create: { id: mockUserId, phone: '8888888899' }
  });

  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId: mockUserId, currency: 'INR' } },
    update: { balance: 100000n }, // 1000 INR Real Money
    create: { userId: mockUserId, currency: 'INR', balance: 100000n }
  });

  // 2. Setup Campaign
  const campaign = await prisma.campaign.create({
    data: {
      name: 'Welcome Free Spins 500',
      type: 'NO_DEPOSIT',
      config: { maxBonus: 50000, wageringReqMultiplier: 10, expiryDays: 3, restrictedGames: ['live-roulette'] }
    }
  });
  console.log(`✅ Created Campaign: ${campaign.name} (Bonus: ₹500, Wagering Req: 10x)`);

  // 3. Test Campaign Activation & Duplicate Protection
  console.log('\n--- Testing Activation & Anti-Abuse ---');
  const bonus = await bonusService.activateCampaign(mockUserId, campaign.id);
  console.log(`   Activated Bonus Balance [${bonus.id}]`);
  console.log(`   Initial Amount: ₹${Number(bonus.initialAmount)/100} | Wager Req: ₹${Number(bonus.wageringRequirement)/100}`);

  try {
    await bonusService.activateCampaign(mockUserId, campaign.id);
    console.log('❌ FAILED: Duplicate claim was allowed.');
  } catch (err) {
    console.log(`   Duplicate Claim Intercepted: ${err.message}`);
  }

  // 4. Test Partial Wagering
  console.log('\n--- Testing Wagering Lifecycle ---');
  // Wager 200 INR (20000 paise). Should deduct from Bonus first.
  const wager1 = await bonusService.processBonusWager(mockUserId, 'slots', 20000n, 'wager-ref-1');
  console.log(`   Placed ₹200 Wager on Slots.`);
  console.log(`   Deducted from Bonus: ₹${Number(wager1.deductedFromBonus)/100}`);
  
  let b = await prisma.bonusBalance.findUnique({ where: { id: bonus.id } });
  console.log(`   Bonus Remaining: ₹${Number(b.currentAmount)/100} | Wagered So Far: ₹${Number(b.wageredAmount)/100}`);

  // Test restricted game
  const wager2 = await bonusService.processBonusWager(mockUserId, 'live-roulette', 10000n, 'wager-ref-2');
  console.log(`   Placed ₹100 Wager on Restricted Game (Live Roulette).`);
  console.log(`   Deducted from Bonus: ₹${Number(wager2.deductedFromBonus)/100} (Expected 0)`);
  console.log(`   Remaining to Deduct from Real Cash: ₹${Number(wager2.remainingToDeductFromReal)/100}`);

  // 5. Test Win Credit
  console.log('\n--- Testing Bonus Win ---');
  const win = await bonusService.creditBonusWin(mockUserId, 40000n, 'wager-ref-1'); // Win ₹400
  console.log(`   Won ₹400 on wager-ref-1.`);
  console.log(`   Credited to Bonus: ₹${Number(win.creditedToBonus)/100}`);
  b = await prisma.bonusBalance.findUnique({ where: { id: bonus.id } });
  console.log(`   New Bonus Balance: ₹${Number(b.currentAmount)/100}`);

  // 6. Test Wagering Completion & Conversion
  console.log('\n--- Testing Conversion to Real Cash ---');
  // We need to wager another 4800 INR (480000 paise) to meet 5000 INR requirement.
  // Wait, currentAmount is only 700 INR. We can't wager 4800. We will just simulate completing the requirement artificially for the test.
  
  await prisma.bonusBalance.update({
    where: { id: bonus.id },
    data: { wageredAmount: bonus.wageringRequirement, currentAmount: 100000n } // 1000 INR remaining
  });
  console.log(`   Artificially set wageredAmount = Requirement, and Balance = ₹1000`);
  
  await bonusService.checkConversion(bonus.id);
  b = await prisma.bonusBalance.findUnique({ where: { id: bonus.id } });
  console.log(`   Bonus Status After Conversion: ${b.status} (Expected: COMPLETED)`);
  console.log(`   Bonus Balance: ₹${Number(b.currentAmount)/100}`);
  
  const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });
  console.log(`   Real Wallet Balance: ₹${Number(updatedWallet.balance)/100} (Expected ₹1000 + ₹1000 converted = ₹2000)`);

  console.log('\n✅ Bonus & Promotion Test Suite Completed.');
}

testBonusSystem().catch(console.error).finally(() => prisma.$disconnect());
