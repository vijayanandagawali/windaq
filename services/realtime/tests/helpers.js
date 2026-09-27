/**
 * Integration-test harness.
 *
 * Safety: tests TRUNCATE every table, so they only run against an explicitly configured,
 * disposable database (DATABASE_URL_TEST) on a local host, and never against the DATABASE_URL
 * configured in the repo's .env. Must be required before any module that creates a PrismaClient.
 */
const path = require('path');
const fs = require('fs');

const TEST_URL = process.env.DATABASE_URL_TEST;
if (!TEST_URL) {
  throw new Error('DATABASE_URL_TEST is not set. Point it at a disposable local Postgres (see TESTING notes in services/realtime/tests/README.md).');
}

const rootEnvPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  const parsed = require('dotenv').parse(fs.readFileSync(rootEnvPath));
  if (parsed.DATABASE_URL && parsed.DATABASE_URL.trim() === TEST_URL.trim()) {
    throw new Error('DATABASE_URL_TEST must not equal the DATABASE_URL in .env — refusing to wipe that database.');
  }
}

const host = new URL(TEST_URL).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== 'true') {
  throw new Error(`Refusing to run destructive tests against non-local database host "${host}".`);
}

process.env.DATABASE_URL = TEST_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-jwt-secret-' + 'x'.repeat(48);
delete process.env.DEV_FIXED_OTP;
delete process.env.FAST2SMS_API_KEY;

const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const walletService = require('../src/services/walletService');

const prisma = new PrismaClient();

async function resetDb() {
  const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let userCounter = 0;

/**
 * Creates a user whose starting balance is booked through the ledger (as a verified deposit),
 * so wallet and ledger agree from the start.
 */
async function createUser({ role = 'USER', balancePaise = 0n, id, isGuest = false } = {}) {
  userCounter += 1;
  const userId = id || `${isGuest ? 'sbx_guest_' : 'usr_test_'}${Date.now().toString(36)}${userCounter}`;
  const phone = `+9170000${String(userCounter).padStart(5, '0')}${Math.floor(Math.random() * 10)}`;
  await prisma.user.create({ data: { id: userId, phone, role } });
  await walletService.ensureUserAndWallet(prisma, userId, { initialPaise: 0n });
  if (balancePaise > 0n) {
    await prisma.$transaction((tx) => walletService.creditDeposit(tx, userId, balancePaise, `seed-${userId}`, 'TEST_SEED'));
  }
  return { id: userId, phone, role, isGuest };
}

function tokenFor(user, overrides = {}) {
  return jwt.sign(
    { userId: user.id, phone: user.phone, role: user.role, isGuest: Boolean(user.isGuest), ...overrides },
    process.env.JWT_SECRET,
    { expiresIn: '1h', algorithm: 'HS256' }
  );
}

async function getWallet(userId) {
  return prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
}

/**
 * Ledger invariant: the USER ledger account net must equal the wallet's available balance
 * (balance - lockedBalance). Withdrawal holds debit the ledger immediately but only lock the wallet.
 */
async function assertLedgerMatchesWallet(assert, userId) {
  const [row] = await prisma.$queryRaw`
    SELECT
      COALESCE((SELECT SUM(amount) FROM "LedgerTransaction" WHERE "creditAccountId" = ${'USER:' + userId}), 0)::bigint -
      COALESCE((SELECT SUM(amount) FROM "LedgerTransaction" WHERE "debitAccountId" = ${'USER:' + userId}), 0)::bigint AS net`;
  const wallet = await getWallet(userId);
  const available = BigInt(wallet.balance) - BigInt(wallet.lockedBalance);
  assert.equal(BigInt(row.net), available, `ledger net ${row.net} != wallet available ${available} for ${userId}`);
}

async function startHttp() {
  const { createApp } = require('../src/app');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    close: () => new Promise((resolve) => server.close(resolve)),
    async request(method, route, { token, body, headers = {} } = {}) {
      const res = await fetch(url + route, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* non-JSON body */ }
      return { status: res.status, body: json, text };
    }
  };
}

module.exports = { prisma, resetDb, createUser, tokenFor, getWallet, assertLedgerMatchesWallet, startHttp };
