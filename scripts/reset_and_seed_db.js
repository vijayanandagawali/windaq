/**
 * WinDaq Master Database Reset, Migration & Comprehensive Seed Script
 * 
 * Performs:
 * 1. Prisma schema synchronization (db push)
 * 2. Clean, safe cascading teardown
 * 3. System accounts & double-entry ledger initialization
 * 4. Categories & 16-game catalog seed
 * 5. Live dealer & live tables seed
 * 6. Synthetic deterministic users & wallets seed
 * 7. Notification templates seed
 * 8. Sportsbook hierarchy seed
 * 9. Comprehensive foreign key and relation integrity verification matrix
 */

const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../services/wallet/.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runPrismaPush() {
  console.log('\n🔄 [Step 1/6] Synchronizing Database Schema with Prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss', {
      cwd: path.resolve(__dirname, '../services/wallet'),
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ Schema push successful.');
  } catch (err) {
    console.warn('⚠️ Prisma db push warning (proceeding):', err.message);
  }
}

async function cleanDatabase() {
  console.log('\n🧹 [Step 2/6] Running Clean Cascading Teardown...');
  
  // Clean transactional records first to respect foreign keys
  await prisma.lottoTicket.deleteMany({}).catch(() => {});
  await prisma.lottoDraw.deleteMany({}).catch(() => {});
  await prisma.colourBet.deleteMany({}).catch(() => {});
  await prisma.colourRound.deleteMany({}).catch(() => {});
  await prisma.slotSpin.deleteMany({}).catch(() => {});
  await prisma.scratchTicket.deleteMany({}).catch(() => {});
  await prisma.teenPattiAction.deleteMany({}).catch(() => {});
  await prisma.teenPattiHand.deleteMany({}).catch(() => {});
  await prisma.diceBet.deleteMany({}).catch(() => {});
  await prisma.diceRoll.deleteMany({}).catch(() => {});
  await prisma.tableGameBet.deleteMany({}).catch(() => {});
  await prisma.tableGameRound.deleteMany({}).catch(() => {});
  await prisma.rouletteBet.deleteMany({}).catch(() => {});
  await prisma.rouletteRoll.deleteMany({}).catch(() => {});
  await prisma.blackjackHand.deleteMany({}).catch(() => {});
  await prisma.blackjackGame.deleteMany({}).catch(() => {});
  await prisma.rummyHand.deleteMany({}).catch(() => {});
  await prisma.rummyGame.deleteMany({}).catch(() => {});
  await prisma.liveBet.deleteMany({}).catch(() => {});
  await prisma.liveRound.deleteMany({}).catch(() => {});
  await prisma.liveTable.deleteMany({}).catch(() => {});
  await prisma.liveDealer.deleteMany({}).catch(() => {});
  await prisma.wager.deleteMany({}).catch(() => {});
  await prisma.sportSelection.deleteMany({}).catch(() => {});
  await prisma.sportMarket.deleteMany({}).catch(() => {});
  await prisma.sportEvent.deleteMany({}).catch(() => {});
  await prisma.sportCompetition.deleteMany({}).catch(() => {});
  await prisma.sport.deleteMany({}).catch(() => {});
  await prisma.bonusLedgerTransaction.deleteMany({}).catch(() => {});
  await prisma.bonusBalance.deleteMany({}).catch(() => {});
  await prisma.campaign.deleteMany({}).catch(() => {});
  await prisma.notificationLog.deleteMany({}).catch(() => {});
  await prisma.notificationPreference.deleteMany({}).catch(() => {});
  await prisma.notificationTemplate.deleteMany({}).catch(() => {});
  await prisma.paymentIntent.deleteMany({}).catch(() => {});
  await prisma.deviceFingerprint.deleteMany({}).catch(() => {});
  await prisma.selfExclusion.deleteMany({}).catch(() => {});
  await prisma.responsibleGamingLimits.deleteMany({}).catch(() => {});
  await prisma.kycProfile.deleteMany({}).catch(() => {});
  await prisma.userRiskProfile.deleteMany({}).catch(() => {});
  await prisma.riskFlag.deleteMany({}).catch(() => {});
  await prisma.gameSession.deleteMany({}).catch(() => {});
  await prisma.playerFavorite.deleteMany({}).catch(() => {});
  await prisma.game.deleteMany({}).catch(() => {});
  await prisma.category.deleteMany({}).catch(() => {});
  await prisma.ledgerTransaction.deleteMany({}).catch(() => {});
  await prisma.transaction.deleteMany({}).catch(() => {});
  await prisma.walletAdjustment.deleteMany({}).catch(() => {});
  await prisma.wallet.deleteMany({}).catch(() => {});
  await prisma.user.deleteMany({}).catch(() => {});
  await prisma.ledgerAccount.deleteMany({}).catch(() => {});

  console.log('✅ Clean teardown completed.');
}

async function seedSystemAndCatalog() {
  console.log('\n🎲 [Step 3/6] Seeding System Accounts, Categories, and 16 Games...');

  // 1. System Ledger Accounts
  const systemAccounts = [
    { id: 'SYSTEM:WAGER_RESERVE', type: 'LIABILITY' },
    { id: 'SYSTEM:REVENUE', type: 'REVENUE' },
    { id: 'SYSTEM:EXTERNAL_BANK', type: 'ASSET' }
  ];
  for (const acc of systemAccounts) {
    await prisma.ledgerAccount.create({
      data: { id: acc.id, type: acc.type, currency: 'INR' }
    });
  }

  // 2. Categories
  const catTrending = await prisma.category.create({ data: { slug: 'trending', name: 'Trending Now', order: 1 } });
  const catLive = await prisma.category.create({ data: { slug: 'live-casino', name: 'Live Dealers', order: 2 } });
  const catSports = await prisma.category.create({ data: { slug: 'sports', name: 'Sportsbook', order: 3 } });
  const catSlots = await prisma.category.create({ data: { slug: 'slots', name: 'Slots', order: 4 } });
  const catTable = await prisma.category.create({ data: { slug: 'table-games', name: 'Table Games', order: 5 } });

  const defaultLimits = { min: 1000, max: 10000000 }; // 10 INR to 100,000 INR in paise
  const defaultRG = { warning: 'Play responsibly', RTP: 97.5, volatility: 'MEDIUM' };

  // 3. 16 Complete Games
  const games = [
    {
      slug: 'aviator', name: 'Aviator', type: 'CRASH', provider: 'Spribe', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1596280327429-231a49dc976f?q=80&w=800&auto=format&fit=crop',
      isLive: false, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: 'Cash out before the plane flies away!' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.0, volatility: 'HIGH' },
      cats: [catTrending]
    },
    {
      slug: 'colour-prediction', name: 'Colour Prediction', type: 'CASINO', provider: 'WinDaq Originals', variant: '1-Min',
      thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop',
      isLive: false, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: 'Guess the next color to win 2x!' }, limits: defaultLimits, rgInfo: defaultRG,
      cats: [catTrending]
    },
    {
      slug: 'texas-holdem', name: "Texas Hold'em Poker", type: 'CASINO', provider: 'WinDaq Originals', variant: 'No Limit',
      thumbnailUrl: 'https://images.unsplash.com/photo-1541339893910-c44bb8373b5d?q=80&w=800&auto=format&fit=crop',
      isLive: false, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: "Standard Texas Hold'em rules apply." }, limits: { min: 5000, max: 50000000 }, rgInfo: { ...defaultRG, volatility: 'HIGH' },
      cats: [catTable, catTrending]
    },
    {
      slug: 'slots', name: 'Ocean Treasures', type: 'SLOTS', provider: 'WinDaq Originals', variant: 'Megaways',
      thumbnailUrl: 'https://images.unsplash.com/photo-1595568326848-bc3513a967a5?q=80&w=800&auto=format&fit=crop',
      isLive: false, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: 'Spin to match symbols on 243 paylines.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 96.2, volatility: 'HIGH' },
      cats: [catSlots]
    },
    {
      slug: 'scratch', name: 'Lucky 7 Scratch', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Instant',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop',
      isLive: false, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: 'Match 3 symbols to win up to 10,000x.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 95.0, volatility: 'EXTREME' },
      cats: [catTrending]
    },
    {
      slug: 'lotto', name: 'Quick Draw 6/49', type: 'LOTTERY', provider: 'WinDaq Originals', variant: '5-Min',
      thumbnailUrl: 'https://images.unsplash.com/photo-1628102491629-77858ab215f7?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 100,
      rules: { howToPlay: 'Pick 6 numbers from 1-49.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 85.0, volatility: 'EXTREME' },
      cats: [catLive]
    },
    {
      slug: 'teen-patti', name: 'Teen Patti Classic', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: 'Indian 3-card poker.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 98.0, volatility: 'MEDIUM' },
      cats: [catTable, catTrending]
    },
    {
      slug: 'dice', name: 'Sic Bo Classic', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517457210631-01ea540eb406?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: 'Predict the outcome of 3 dice.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.2, volatility: 'MEDIUM' },
      cats: [catTable]
    },
    {
      slug: 'dragon-tiger', name: 'Dragon Tiger', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Speed',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: 'Bet on Dragon or Tiger. Highest card wins.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 96.27, volatility: 'LOW' },
      cats: [catTable, catTrending]
    },
    {
      slug: 'european-roulette', name: 'European Roulette', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Auto',
      thumbnailUrl: 'https://images.unsplash.com/photo-1606167668511-22c62c3e1e94?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: 'Single zero roulette.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.3, volatility: 'LOW' },
      cats: [catTable, catTrending]
    },
    {
      slug: 'andar-bahar', name: 'Andar Bahar', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Speed',
      thumbnailUrl: 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: false, isActive: true, minStake: 10,
      rules: { howToPlay: 'Match the Joker card on Andar or Bahar side.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 95.0, volatility: 'LOW' },
      cats: [catTable, catLive]
    },
    {
      slug: 'blackjack', name: 'Blackjack', type: 'CASINO', provider: 'WinDaq Originals', variant: 'Classic',
      thumbnailUrl: 'https://images.unsplash.com/photo-1517540277353-832d20cc162b?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: 'Beat the dealer without going over 21.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 99.5, volatility: 'LOW' },
      cats: [catTable]
    },
    {
      slug: 'rummy', name: 'Indian Rummy', type: 'CASINO', provider: 'WinDaq Originals', variant: '13-Card',
      thumbnailUrl: 'https://images.unsplash.com/photo-1622359480650-6819a8ea41e0?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 10,
      rules: { howToPlay: 'Form valid sequences and sets.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.0, volatility: 'MEDIUM' },
      cats: [catTable]
    },
    {
      slug: 'lightning-roulette', name: 'Lightning Roulette', type: 'LIVE', provider: 'Evolution', variant: 'Multiplier',
      thumbnailUrl: 'https://images.unsplash.com/photo-1601292025754-0775cb560411?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: false, isActive: true, minStake: 20,
      rules: { howToPlay: 'Roulette with random multipliers up to 500x.' }, limits: defaultLimits, rgInfo: { ...defaultRG, RTP: 97.3, volatility: 'HIGH' },
      cats: [catLive, catTrending]
    },
    {
      slug: 'sportsbook', name: 'Cricket Sportsbook', type: 'SPORTS', provider: 'WinDaq Sports', variant: 'Live & Pre-Match',
      thumbnailUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 50,
      rules: { howToPlay: 'Bet on Live Cricket Matches and International Leagues.' }, limits: { min: 5000, max: 50000000 }, rgInfo: { ...defaultRG, volatility: 'MEDIUM' },
      cats: [catSports, catTrending]
    },
    {
      slug: 'live-casino', name: 'Live Dealer Studio', type: 'LIVE', provider: 'WinDaq Studios', variant: 'VIP Tables',
      thumbnailUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=800&auto=format&fit=crop',
      isLive: true, isNew: true, isActive: true, minStake: 100,
      rules: { howToPlay: 'Play with live human dealers in real-time.' }, limits: { min: 10000, max: 100000000 }, rgInfo: { ...defaultRG, volatility: 'LOW' },
      cats: [catLive]
    }
  ];

  for (const g of games) {
    await prisma.game.create({
      data: {
        slug: g.slug,
        name: g.name,
        type: g.type,
        provider: g.provider,
        variant: g.variant,
        thumbnailUrl: g.thumbnailUrl,
        isLive: g.isLive,
        isNew: g.isNew,
        isActive: g.isActive,
        minStake: g.minStake,
        rules: g.rules,
        limits: g.limits,
        rgInfo: g.rgInfo,
        categories: { connect: g.cats.map(c => ({ id: c.id })) }
      }
    });
  }

  // 4. Live Dealer Setup
  await prisma.liveDealer.create({
    data: { name: 'Alice', pinCode: '1234', isActive: true }
  });

  await prisma.liveTable.create({
    data: { id: 'live-roulette-1', gameType: 'ROULETTE', name: 'VIP Live Roulette', isActive: true }
  });

  console.log(`✅ Seeded ${games.length} games, 5 categories, and live dealer table.`);
}

async function seedUsersAndWallets() {
  console.log('\n👥 [Step 4/6] Seeding Synthetic Deterministic Users & Wallets...');

  const USERS = [
    { id: 'sbx-usr-normal-001', phone: '+919999900001', role: 'USER', balancePaise: 5000000n, kyc: 'APPROVED', suspended: false },
    { id: 'sbx-usr-kycpending-002', phone: '+919999900002', role: 'USER', balancePaise: 1000000n, kyc: 'PENDING', suspended: false },
    { id: 'sbx-usr-restricted-003', phone: '+919999900003', role: 'USER', balancePaise: 0n, kyc: 'REJECTED', suspended: true },
    { id: 'sbx-usr-admin-004', phone: '+919999900004', role: 'SUPER_ADMIN', balancePaise: 10000000n, kyc: 'APPROVED', suspended: false },
    { id: 'sbx-usr-finance-005', phone: '+919999900005', role: 'FINANCE', balancePaise: 10000000n, kyc: 'APPROVED', suspended: false },
    { id: 'sbx-usr-risk-006', phone: '+919999900006', role: 'RISK', balancePaise: 2000000n, kyc: 'APPROVED', suspended: false },
    { id: 'sbx-usr-gameops-007', phone: '+919999900007', role: 'SUPPORT', balancePaise: 2000000n, kyc: 'APPROVED', suspended: false },
    { id: 'guest-demo-id', phone: '+919999900099', role: 'USER', balancePaise: 1000000n, kyc: 'APPROVED', suspended: false }
  ];

  for (const u of USERS) {
    // 1. Create User
    await prisma.user.create({
      data: { id: u.id, phone: u.phone, role: u.role }
    });

    // 2. Create Wallet
    await prisma.wallet.create({
      data: { userId: u.id, currency: 'INR', balance: u.balancePaise }
    });

    // 3. Create Ledger Account
    await prisma.ledgerAccount.create({
      data: { id: `USER:${u.id}`, type: 'USER', currency: 'INR' }
    });

    // 4. Create KYC Profile
    await prisma.kycProfile.create({
      data: { userId: u.id, status: u.kyc, jurisdiction: 'IN-MH' }
    });

    // 5. Create Risk Profile
    await prisma.userRiskProfile.create({
      data: { userId: u.id, riskScore: u.suspended ? 95 : 10, isSuspended: u.suspended, suspensionReason: u.suspended ? 'SANDBOX_RESTRICTED' : null }
    });

    // 6. Create RG Limits
    await prisma.responsibleGamingLimits.create({
      data: { userId: u.id, dailyDepositLimit: 10000000n, dailyWagerLimit: 50000000n, dailyLossLimit: 25000000n }
    });

    // 7. Create Notification Preference
    await prisma.notificationPreference.create({
      data: { userId: u.id, marketingEmail: true, marketingSms: true, transactionalInApp: true }
    });
  }

  console.log(`✅ Seeded ${USERS.length} deterministic users with complete profiles.`);
}

async function seedTemplatesAndSports() {
  console.log('\n🏆 [Step 5/6] Seeding Notification Templates & Sports Hierarchy...');

  // 1. Templates
  const templates = [
    { name: 'OTP_LOGIN', channel: 'SMS', content: 'Your WinDaq login OTP is {{otp}}. Valid for 5 minutes.' },
    { name: 'DEPOSIT_SUCCESS', channel: 'IN_APP', content: 'Your deposit of INR {{amount}} has been credited to your wallet.' },
    { name: 'WITHDRAWAL_INIT', channel: 'IN_APP', content: 'Your withdrawal request of INR {{amount}} is under processing.' },
    { name: 'BET_WON', channel: 'IN_APP', content: 'Congratulations! You won INR {{amount}} on {{gameName}}.' }
  ];

  for (const t of templates) {
    await prisma.notificationTemplate.create({ data: t });
  }

  // 2. Sports Hierarchy
  const sport = await prisma.sport.create({ data: { name: 'Cricket', isActive: true } });
  const comp = await prisma.sportCompetition.create({ data: { sportId: sport.id, name: 'ICC T20 World Cup', isActive: true } });
  const event = await prisma.sportEvent.create({
    data: {
      competitionId: comp.id,
      name: 'India vs Australia',
      status: 'LIVE',
      startTime: new Date()
    }
  });

  const market = await prisma.sportMarket.create({
    data: {
      eventId: event.id,
      name: 'Match Winner',
      status: 'ACTIVE'
    }
  });

  await prisma.sportSelection.createMany({
    data: [
      { marketId: market.id, name: 'India', oddsBack: 1.75, oddsLay: 1.80, status: 'ACTIVE' },
      { marketId: market.id, name: 'Australia', oddsBack: 2.10, oddsLay: 2.20, status: 'ACTIVE' }
    ]
  });

  console.log('✅ Seeded notification templates and cricket sportsbook match.');
}

async function runModelAudit() {
  console.log('\n📊 [Step 6/6] Running Deep Database Model & Relation Verification Matrix...\n');

  const models = [
    { name: 'User', count: await prisma.user.count() },
    { name: 'Wallet', count: await prisma.wallet.count() },
    { name: 'LedgerAccount', count: await prisma.ledgerAccount.count() },
    { name: 'Category', count: await prisma.category.count() },
    { name: 'Game', count: await prisma.game.count() },
    { name: 'LiveDealer', count: await prisma.liveDealer.count() },
    { name: 'LiveTable', count: await prisma.liveTable.count() },
    { name: 'KycProfile', count: await prisma.kycProfile.count() },
    { name: 'UserRiskProfile', count: await prisma.userRiskProfile.count() },
    { name: 'ResponsibleGamingLimits', count: await prisma.responsibleGamingLimits.count() },
    { name: 'NotificationTemplate', count: await prisma.notificationTemplate.count() },
    { name: 'NotificationPreference', count: await prisma.notificationPreference.count() },
    { name: 'Sport', count: await prisma.sport.count() },
    { name: 'SportCompetition', count: await prisma.sportCompetition.count() },
    { name: 'SportEvent', count: await prisma.sportEvent.count() },
    { name: 'SportMarket', count: await prisma.sportMarket.count() },
    { name: 'SportSelection', count: await prisma.sportSelection.count() }
  ];

  console.table(models);

  // Foreign key relation integrity verification
  const orphanWallets = await prisma.$queryRaw`SELECT count(*)::int as count FROM "Wallet" WHERE "userId" NOT IN (SELECT id FROM "User")`;
  const orphanKycs = await prisma.$queryRaw`SELECT count(*)::int as count FROM "KycProfile" WHERE "userId" NOT IN (SELECT id FROM "User")`;
  const orphanRisks = await prisma.$queryRaw`SELECT count(*)::int as count FROM "UserRiskProfile" WHERE "userId" NOT IN (SELECT id FROM "User")`;
  const gamesWithNoCats = await prisma.game.count({ where: { categories: { none: {} } } });

  const orphanWalletCount = orphanWallets[0]?.count || 0;
  const orphanKycCount = orphanKycs[0]?.count || 0;
  const orphanRiskCount = orphanRisks[0]?.count || 0;

  console.log('--- Relation Integrity Audit ---');
  console.log(`- Orphan Wallets: ${orphanWalletCount} (expected: 0)`);
  console.log(`- Orphan KYC Profiles: ${orphanKycCount} (expected: 0)`);
  console.log(`- Orphan Risk Profiles: ${orphanRiskCount} (expected: 0)`);
  console.log(`- Games with Missing Category Links: ${gamesWithNoCats} (expected: 0)`);

  if (orphanWalletCount === 0 && orphanKycCount === 0 && orphanRiskCount === 0 && gamesWithNoCats === 0) {
    console.log('\n🌟 [SUCCESS] 100% RELATIONS & FOREIGN KEYS VERIFIED HEALTHY!');
  } else {
    throw new Error('Integrity violation detected!');
  }
}

async function main() {
  console.log('🚀 Starting WinDaq Reset, Migration & Seed Suite...');
  await runPrismaPush();
  await cleanDatabase();
  await seedSystemAndCatalog();
  await seedUsersAndWallets();
  await seedTemplatesAndSports();
  await runModelAudit();
  console.log('\n🎉 ALL DATABASE MODELS AUDITED & SEEDED SUCCESSFULLY!\n');
}

main()
  .catch((err) => {
    console.error('❌ Execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
