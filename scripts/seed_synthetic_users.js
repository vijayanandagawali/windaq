require('dotenv').config({ path: require('path').resolve(__dirname, '../services/wallet/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SYNTHETIC_USERS = [
  {
    id: 'sbx-usr-normal-001',
    phone: '+919999900001',
    role: 'USER',
    name: 'Sandbox Normal Player',
    balancePaise: 5000000n, // ₹50,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  {
    id: 'sbx-usr-kycpending-002',
    phone: '+919999900002',
    role: 'USER',
    name: 'Sandbox KYC Pending',
    balancePaise: 1000000n, // ₹10,000.00
    kycStatus: 'PENDING',
    isSuspended: false,
  },
  {
    id: 'sbx-usr-restricted-003',
    phone: '+919999900003',
    role: 'USER',
    name: 'Sandbox Restricted User',
    balancePaise: 0n,
    kycStatus: 'REJECTED',
    isSuspended: true,
    suspensionReason: 'SANDBOX_RESTRICTED_FOR_TESTING'
  },
  {
    id: 'sbx-usr-admin-004',
    phone: '+919999900004',
    role: 'SUPER_ADMIN',
    name: 'Sandbox Super Admin',
    balancePaise: 10000000n, // ₹100,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  {
    id: 'sbx-usr-finance-005',
    phone: '+919999900005',
    role: 'FINANCE',
    name: 'Sandbox Finance Officer',
    balancePaise: 10000000n, // ₹100,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  {
    id: 'sbx-usr-risk-006',
    phone: '+919999900006',
    role: 'RISK',
    name: 'Sandbox Risk Surveillance',
    balancePaise: 2000000n, // ₹20,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  {
    id: 'sbx-usr-gameops-007',
    phone: '+919999900007',
    role: 'SUPPORT',
    name: 'Sandbox Game Ops',
    balancePaise: 2000000n, // ₹20,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  // --- Prompt #61 Synthetic Sandbox Users for Automated Testing ---
  {
    id: 'TEST_PLAYER_01',
    phone: '+919999910001',
    role: 'USER',
    name: 'Test Player 01',
    balancePaise: 5000000n, // ₹50,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  {
    id: 'TEST_PLAYER_02',
    phone: '+919999910002',
    role: 'USER',
    name: 'Test Player 02',
    balancePaise: 2500000n, // ₹25,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  },
  {
    id: 'TEST_KYC_PENDING',
    phone: '+919999910003',
    role: 'USER',
    name: 'Test KYC Pending',
    balancePaise: 1000000n, // ₹10,000.00
    kycStatus: 'PENDING',
    isSuspended: false,
  },
  {
    id: 'TEST_RESTRICTED',
    phone: '+919999910004',
    role: 'USER',
    name: 'Test Restricted User',
    balancePaise: 0n,
    kycStatus: 'REJECTED',
    isSuspended: true,
    suspensionReason: 'ACCOUNT_RESTRICTED_FOR_TESTING'
  },
  {
    id: 'TEST_ADMIN',
    phone: '+919999910005',
    role: 'SUPER_ADMIN',
    name: 'Test Admin',
    balancePaise: 10000000n, // ₹100,000.00
    kycStatus: 'APPROVED',
    isSuspended: false,
  }
];

async function seedSyntheticUsers() {
  console.log('--- [SANDBOX] Seeding Synthetic Users & Deterministic Test Data ---');

  // Ensure system ledger accounts exist
  const systemAccounts = [
    { id: 'SYSTEM:WAGER_RESERVE', type: 'LIABILITY' },
    { id: 'SYSTEM:REVENUE', type: 'REVENUE' },
    { id: 'SYSTEM:EXTERNAL_BANK', type: 'ASSET' }
  ];

  for (const acc of systemAccounts) {
    await prisma.ledgerAccount.upsert({
      where: { id: acc.id },
      update: {},
      create: { id: acc.id, type: acc.type, currency: 'INR' }
    });
  }

  for (const u of SYNTHETIC_USERS) {
    // Upsert User
    const user = await prisma.user.upsert({
      where: { id: u.id },
      update: {
        phone: u.phone,
        role: u.role,
      },
      create: {
        id: u.id,
        phone: u.phone,
        role: u.role,
      }
    });

    // Upsert Wallet
    const wallet = await prisma.wallet.upsert({
      where: {
        userId_currency: {
          userId: user.id,
          currency: 'INR'
        }
      },
      update: {
        balance: u.balancePaise
      },
      create: {
        userId: user.id,
        currency: 'INR',
        balance: u.balancePaise
      }
    });

    // Ledger User Account
    await prisma.ledgerAccount.upsert({
      where: { id: `USER:${user.id}` },
      update: {},
      create: {
        id: `USER:${user.id}`,
        type: 'USER',
        currency: 'INR'
      }
    });

    // KYC Profile
    await prisma.kycProfile.upsert({
      where: { userId: user.id },
      update: {
        status: u.kycStatus,
        jurisdiction: 'IN-MH'
      },
      create: {
        userId: user.id,
        status: u.kycStatus,
        jurisdiction: 'IN-MH'
      }
    });

    // Risk Profile
    await prisma.userRiskProfile.upsert({
      where: { userId: user.id },
      update: {
        isSuspended: u.isSuspended,
        suspensionReason: u.suspensionReason || null,
        riskScore: u.isSuspended ? 95 : 10
      },
      create: {
        userId: user.id,
        isSuspended: u.isSuspended,
        suspensionReason: u.suspensionReason || null,
        riskScore: u.isSuspended ? 95 : 10
      }
    });

    console.log(`✓ Seeded ${u.name} (${u.role}) | Balance: ₹${Number(u.balancePaise)/100} | Phone: ${u.phone}`);
  }

  console.log('--- [SANDBOX] Synthetic Users Seeding Completed Successfully ---');
}

seedSyntheticUsers()
  .catch((err) => {
    console.error('Error seeding synthetic users:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
