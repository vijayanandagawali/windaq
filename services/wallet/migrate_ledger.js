const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log("Starting Ledger Migration...");

  // 1. Create System Accounts
  const systemAccounts = [
    { id: 'SYSTEM:WAGER_RESERVE', type: 'LIABILITY' },
    { id: 'SYSTEM:REVENUE', type: 'REVENUE' },
    { id: 'SYSTEM:EXTERNAL_BANK', type: 'ASSET' },
    { id: 'SYSTEM:MIGRATION', type: 'EQUITY' } // Used for initial balance injection
  ];

  for (const acc of systemAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { id: acc.id },
      update: {},
      create: { id: acc.id, type: acc.type }
    });
  }

  // 2. Migrate existing wallets
  const wallets = await prisma.wallet.findMany();
  let migratedCount = 0;

  for (const w of wallets) {
    const userAccountId = `USER:${w.userId}`;
    
    // Ensure User Ledger Account exists
    await prisma.ledgerAccount.upsert({
      where: { id: userAccountId },
      update: {},
      create: { id: userAccountId, type: 'USER' }
    });

    // If balance > 0, inject via Migration account
    if (w.balance > 0) {
      const idempotencyKey = `migration-${w.id}`;
      const existingTx = await prisma.ledgerTransaction.findUnique({ where: { idempotencyKey } });
      
      if (!existingTx) {
        await prisma.ledgerTransaction.create({
          data: {
            idempotencyKey,
            referenceType: 'MIGRATION',
            debitAccountId: 'SYSTEM:MIGRATION',
            creditAccountId: userAccountId,
            amount: w.balance,
            status: 'COMPLETED',
            auditMetadata: { message: "Initial balance migration" }
          }
        });
        migratedCount++;
      }
    }
  }

  console.log(`Migration Complete. Migrated ${migratedCount} positive wallets to double-entry ledger.`);
  process.exit(0);
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
