/**
 * WinDaq QA Sandbox - Teardown / Reset Command
 * Safely cleans up test transactions, bets, and resets synthetic accounts.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../services/wallet/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function teardownSandbox() {
  console.log('====================================================');
  console.log('    WINDAQ QA / STAGING SANDBOX - RESET / TEARDOWN  ');
  console.log('====================================================');

  try {
    console.log('[1/4] Cleaning transient bets and game sessions...');
    await prisma.colourBet.deleteMany({});
    await prisma.liveBet.deleteMany({});
    await prisma.tableGameBet.deleteMany({});
    await prisma.rouletteBet.deleteMany({});
    await prisma.diceBet.deleteMany({});
    await prisma.wager.deleteMany({});
    await prisma.gameSession.deleteMany({});

    console.log('[2/4] Resetting test transactions & ledger entries...');
    await prisma.transaction.deleteMany({});
    await prisma.ledgerTransaction.deleteMany({});

    console.log('[3/4] Re-initializing deterministic synthetic wallet balances...');
    const users = [
      { id: 'sbx-usr-normal-001', bal: 5000000n },
      { id: 'sbx-usr-kycpending-002', bal: 1000000n },
      { id: 'sbx-usr-restricted-003', bal: 0n },
      { id: 'sbx-usr-admin-004', bal: 10000000n },
      { id: 'sbx-usr-finance-005', bal: 10000000n },
      { id: 'sbx-usr-risk-006', bal: 2000000n },
      { id: 'sbx-usr-gameops-007', bal: 2000000n },
    ];

    for (const u of users) {
      await prisma.wallet.updateMany({
        where: { userId: u.id },
        data: { balance: u.bal }
      });
    }

    console.log('[4/4] Sandbox state successfully restored to clean baseline.');
    console.log('====================================================');
  } catch (err) {
    console.error('Teardown error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

teardownSandbox();
