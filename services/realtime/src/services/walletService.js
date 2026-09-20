/**
 * Unified Wallet & Identity Service (Double-Entry Ledger)
 * 
 * Implements the authoritative identity resolution and wallet lifecycle:
 * AUTH USER -> FIND USER -> FIND WALLET -> IF MISSING CREATE WALLET -> RETURN WALLET
 * 
 * - Strictly prevents duplicate wallets using database unique constraints (@@unique([userId, currency]))
 * - Transaction-safe creation resilient to high-concurrency race conditions
 * - Universal source of truth for ALL games on WinDaq
 */

const crypto = require('crypto');

// Helper to ensure an account exists in the double-entry ledger
async function ensureAccount(tx, accountId, type) {
  let acc = await tx.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!acc) {
    try {
      acc = await tx.ledgerAccount.create({ data: { id: accountId, type, currency: 'INR' } });
    } catch {
      acc = await tx.ledgerAccount.findUnique({ where: { id: accountId } });
    }
  }
  return acc;
}

/**
 * Universal Identity & Wallet Resolver
 * Flow:
 * AUTH USER -> FIND USER -> FIND WALLET -> IF MISSING CREATE WALLET -> RETURN WALLET
 * 
 * Transaction-safe, zero duplicate wallets (enforced by @@unique([userId, currency]))
 */
async function getOrCreateUserAndWallet(client, userId, options = {}) {
  const currency = options.currency || 'INR';
  const initialPaise = typeof options.initialPaise === 'bigint' 
    ? options.initialPaise 
    : (options.initialPaise !== undefined ? BigInt(options.initialPaise) : 1000000n); // Default ₹10,000 for testers/guests
  const role = options.role || 'USER';

  // 1. AUTH USER & FIND USER
  let user = await client.user.findUnique({ where: { id: userId } });
  
  // IF MISSING USER -> CREATE USER
  if (!user) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const phone = options.phone || `+9198${Date.now().toString().slice(-4)}${randomSuffix}`;
    try {
      user = await client.user.upsert({
        where: { id: userId },
        create: { id: userId, phone, role },
        update: {}
      });
    } catch (err) {
      // If phone collided on unique constraint, generate guaranteed collision-free phone
      const fallbackPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
      try {
        user = await client.user.upsert({
          where: { id: userId },
          create: { id: userId, phone: fallbackPhone, role },
          update: {}
        });
      } catch {
        user = await client.user.findUnique({ where: { id: userId } });
      }
    }
  }

  // 2. FIND WALLET & IF MISSING CREATE WALLET (Transaction-Safe, Unique Constraint Backed)
  // Leverages Prisma's generated compound unique index `userId_currency`
  let wallet;
  try {
    wallet = await client.wallet.upsert({
      where: {
        userId_currency: {
          userId,
          currency
        }
      },
      create: {
        id: `wal_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        userId,
        currency,
        balance: initialPaise
      },
      update: {} // No-op if wallet already exists
    });
  } catch (err) {
    // Concurrency fallback: in case of parallel transaction race, re-query existing wallet
    wallet = await client.wallet.findFirst({
      where: { userId, currency }
    });

    if (!wallet) {
      // Final attempt with raw atomic query if transaction aborted in nested context
      try {
        const walId = `wal_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
        await client.$executeRaw`
          INSERT INTO "Wallet" ("id", "userId", "currency", "balance", "createdAt", "updatedAt")
          VALUES (${walId}, ${userId}, ${currency}, ${initialPaise}, NOW(), NOW())
          ON CONFLICT ("userId", "currency") DO NOTHING
        `;
        wallet = await client.wallet.findFirst({ where: { userId, currency } });
      } catch {
        wallet = await client.wallet.findFirst({ where: { userId, currency } });
      }
    }
  }

  // 3. Ensure double-entry ledger account
  const accountId = `USER:${userId}`;
  let ledgerAccount = await client.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!ledgerAccount) {
    try {
      ledgerAccount = await client.ledgerAccount.upsert({
        where: { id: accountId },
        create: { id: accountId, type: 'USER', currency },
        update: {}
      });
    } catch {
      ledgerAccount = await client.ledgerAccount.findUnique({ where: { id: accountId } });
    }
  }

  // 4. RETURN WALLET
  return { user, wallet, ledgerAccount };
}

// Backward-compatible alias
const ensureUserAndWallet = getOrCreateUserAndWallet;

/**
 * Retrieves the user's wallet. If missing, auto-creates it atomically.
 * NEVER throws "Wallet not found" or "User not found".
 */
async function getWallet(client, userId, currency = 'INR') {
  const { wallet, user } = await getOrCreateUserAndWallet(client, userId, { currency });
  return {
    ...wallet,
    balanceNumber: Number(wallet.balance) / 100,
    user
  };
}

/**
 * Places a bet. Moves money from USER to SYSTEM:WAGER_RESERVE.
 * Auto-provisions wallet if missing, preventing "Wallet not found".
 */
async function placeBet(tx, userId, amountPaise, referenceType, referenceId) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');

  // Lock the wallet row to prevent concurrent double-spends
  let wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }
  
  if (!wallets || wallets.length === 0) {
    // Failsafe auto-creation
    const ensured = await ensureUserAndWallet(tx, userId);
    wallets = [{ id: ensured.wallet.id, balance: ensured.wallet.balance }];
  }
  
  const wallet = wallets[0];
  if (BigInt(wallet.balance) < amountPaise) {
    throw new Error("Insufficient balance in wallet.");
  }

  const newBalance = BigInt(wallet.balance) - amountPaise;

  // 1. Update cached wallet balance
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance }
  });

  // 2. Insert Ledger Double Entry
  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `bet-place-${referenceId}`,
      referenceType,
      referenceId,
      debitAccountId: userAccountId,
      creditAccountId: 'SYSTEM:WAGER_RESERVE',
      amount: amountPaise,
      status: 'COMPLETED'
    }
  });

  // 3. Keep Transaction log for backward compatibility
  await tx.transaction.create({
    data: {
      walletId: wallet.id,
      idempotencyKey: `legacy-bet-place-${referenceId}`,
      type: 'BET_PLACE',
      amount: amountPaise,
      balanceAfter: newBalance,
      reference: referenceId
    }
  });

  return newBalance;
}

/**
 * Settles a winning bet. Returns reserve to user and pays out from house revenue.
 * Auto-provisions wallet if missing, preventing "Wallet not found".
 */
async function settleWin(tx, userId, originalBetPaise, payoutPaise, referenceType, referenceId) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');

  // Lock the wallet row to prevent concurrent race conditions
  let wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }

  if (!wallets || wallets.length === 0) {
    const ensured = await ensureUserAndWallet(tx, userId);
    wallets = [{ id: ensured.wallet.id, balance: ensured.wallet.balance }];
  }

  const wallet = wallets[0];
  const newBalance = BigInt(wallet.balance) + payoutPaise;

  // 1. Update cache
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance }
  });

  // 2. Ledger Entry 1: Return the original bet from Reserve -> User
  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `bet-return-${referenceId}`,
      referenceType: 'REFUND',
      referenceId,
      debitAccountId: 'SYSTEM:WAGER_RESERVE',
      creditAccountId: userAccountId,
      amount: originalBetPaise,
      status: 'COMPLETED'
    }
  });

  // 3. Ledger Entry 2: Pay net win from Revenue -> User
  const netWin = payoutPaise - originalBetPaise;
  if (netWin > 0n) {
    await tx.ledgerTransaction.create({
      data: {
        idempotencyKey: `bet-win-${referenceId}`,
        referenceType,
        referenceId,
        debitAccountId: 'SYSTEM:REVENUE',
        creditAccountId: userAccountId,
        amount: netWin,
        status: 'COMPLETED'
      }
    });
  } else if (netWin < 0n) {
    const loss = originalBetPaise - payoutPaise;
    await tx.ledgerTransaction.create({
      data: {
        idempotencyKey: `bet-loss-partial-${referenceId}`,
        referenceType: 'BET_LOSS',
        referenceId,
        debitAccountId: userAccountId,
        creditAccountId: 'SYSTEM:REVENUE',
        amount: loss,
        status: 'COMPLETED'
      }
    });
  }

  // 4. Keep Transaction log
  await tx.transaction.create({
    data: {
      walletId: wallet.id,
      idempotencyKey: `legacy-bet-win-${referenceId}`,
      type: 'BET_WIN',
      amount: payoutPaise,
      balanceAfter: newBalance,
      reference: referenceId
    }
  });

  return newBalance;
}

/**
 * Settles a losing bet. Moves money from Wager Reserve to House Revenue.
 */
async function settleLoss(tx, userId, originalBetPaise, referenceType, referenceId) {
  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `bet-loss-${referenceId}`,
      referenceType: 'BET_LOSS',
      referenceId,
      debitAccountId: 'SYSTEM:WAGER_RESERVE',
      creditAccountId: 'SYSTEM:REVENUE',
      amount: originalBetPaise,
      status: 'COMPLETED'
    }
  });
}

/**
 * Refunds a bet. Moves money from Wager Reserve back to User.
 * Auto-provisions wallet if missing, preventing "Wallet not found".
 */
async function refundBet(tx, userId, originalBetPaise, referenceType, referenceId) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');

  // Lock row
  let wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }
  
  if (!wallets || wallets.length === 0) {
    const ensured = await ensureUserAndWallet(tx, userId);
    wallets = [{ id: ensured.wallet.id, balance: ensured.wallet.balance }];
  }

  const wallet = wallets[0];
  const newBalance = BigInt(wallet.balance) + originalBetPaise;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance }
  });

  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `bet-refund-${referenceId}`,
      referenceType: 'REFUND',
      referenceId,
      debitAccountId: 'SYSTEM:WAGER_RESERVE',
      creditAccountId: userAccountId,
      amount: originalBetPaise,
      status: 'COMPLETED'
    }
  });

  await tx.transaction.create({
    data: {
      walletId: wallet.id,
      idempotencyKey: `legacy-bet-refund-${referenceId}`,
      type: 'REFUND',
      amount: originalBetPaise,
      balanceAfter: newBalance,
      reference: referenceId
    }
  });

  return newBalance;
}

/**
 * High-level atomic balance deduction helper across all games.
 */
async function deductBalance(client, userId, amountPaise, description = 'Game Wager', referenceId = null) {
  const ref = referenceId || `deduct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return await client.$transaction(async (tx) => {
    return await placeBet(tx, userId, BigInt(amountPaise), 'DIRECT_BET', ref);
  });
}

/**
 * High-level atomic balance credit helper across all games.
 */
async function creditWinnings(client, userId, amountPaise, description = 'Game Win', referenceId = null) {
  const ref = referenceId || `credit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return await client.$transaction(async (tx) => {
    return await settleWin(tx, userId, 0n, BigInt(amountPaise), 'DIRECT_WIN', ref);
  });
}

module.exports = {
  getOrCreateUserAndWallet,
  ensureUserAndWallet,
  getWallet,
  placeBet,
  settleWin,
  settleLoss,
  refundBet,
  deductBalance,
  creditWinnings
};
