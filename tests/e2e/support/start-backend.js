/**
 * E2E backend launcher (used by playwright.config.js webServer).
 *
 * 1. Verifies DATABASE_URL_TEST is a local, disposable database that differs from .env.
 * 2. Resets it and seeds the fixed E2E finance operator.
 * 3. Starts the real realtime server against it with test-only secrets.
 */
const path = require('path');
const fs = require('fs');

const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) {
  console.error('DATABASE_URL_TEST is required for E2E (run "npm run db:local" and use the printed test URL).');
  process.exit(1);
}
const rootEnv = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnv)) {
  const parsed = require('dotenv').parse(fs.readFileSync(rootEnv));
  if (parsed.DATABASE_URL && parsed.DATABASE_URL.trim() === TEST_URL.trim()) {
    console.error('DATABASE_URL_TEST must not equal the DATABASE_URL in .env — refusing to wipe it.');
    process.exit(1);
  }
}
const host = new URL(TEST_URL).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
  console.error(`Refusing to reset non-local database host "${host}".`);
  process.exit(1);
}

process.env.DATABASE_URL = TEST_URL;

const { E2E } = require('./constants');

async function resetAndSeed() {
  const { PrismaClient } = require('@prisma/client');
  const walletService = require('../../../services/realtime/src/services/walletService');
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }
    await prisma.user.create({ data: { id: E2E.finance.id, phone: E2E.finance.phoneE164, role: 'FINANCE' } });
    await walletService.ensureUserAndWallet(prisma, E2E.finance.id, { initialPaise: 0n });
  } finally {
    await prisma.$disconnect();
  }
}

resetAndSeed()
  .then(() => {
    console.log('[E2E] Test database reset and seeded.');
    require('../../../services/realtime/server.js');
  })
  .catch((err) => {
    console.error('[E2E] Failed to prepare test database:', err.message);
    process.exit(1);
  });
