/**
 * Unified Wallet & Identity Service (Double-Entry Ledger & Authoritative State Engine)
 * Prompt #69: FinTech Multi-Balance, Row-Level Locking, Idempotency & Reconciliation
 * 
 * PostgreSQL/database is the authoritative source of truth for all balances.
 * Zero client-side balance manipulation, zero negative available balances.
 */

const crypto = require('crypto');

let globalIo = null;

function setIo(ioInstance) {
  globalIo = ioInstance;
}

function emitWalletEvent(userId, event, payload) {
  try {
    if (globalIo) {
      globalIo.to(`user:${userId}`).emit(event, payload);
      // General room for multi-device sync
      globalIo.emit(event, { ...payload, userId });
    }
  } catch (err) {
    console.warn('[WalletService:emitWalletEvent Error]:', err.message);
  }
}

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
    } catch {
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
        balance: initialPaise,
        lockedBalance: 0n,
        pendingDeposit: 0n,
        pendingWithdrawal: 0n,
        bonusBalance: 0n,
        totalDeposited: 0n,
        totalWithdrawn: 0n,
        totalWon: 0n,
        totalLost: 0n
      },
      update: {}
    });
  } catch {
    wallet = await client.wallet.findFirst({
      where: { userId, currency }
    });

    if (!wallet) {
      try {
        const walId = `wal_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
        await client.$executeRaw`
          INSERT INTO "Wallet" ("id", "userId", "currency", "balance", "lockedBalance", "pendingDeposit", "pendingWithdrawal", "bonusBalance", "totalDeposited", "totalWithdrawn", "totalWon", "totalLost", "createdAt", "updatedAt")
          VALUES (${walId}, ${userId}, ${currency}, ${initialPaise}, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())
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
 * Retrieves the user's authoritative wallet with all sub-balance breakdowns.
 * NEVER throws "Wallet not found" or "User not found".
 */
async function getWallet(client, userId, currency = 'INR') {
  const { wallet, user } = await getOrCreateUserAndWallet(client, userId, { currency });
  
  const totalPaise = BigInt(wallet.balance || 0n);
  const lockedPaise = BigInt(wallet.lockedBalance || 0n);
  const pendingDepPaise = BigInt(wallet.pendingDeposit || 0n);
  const pendingWdrPaise = BigInt(wallet.pendingWithdrawal || 0n);
  const bonusPaise = BigInt(wallet.bonusBalance || 0n);
  const availablePaise = totalPaise >= lockedPaise ? (totalPaise - lockedPaise) : 0n;

  return {
    ...wallet,
    availableBalance: availablePaise,
    balanceNumber: Number(totalPaise) / 100,
    availableBalanceNumber: Number(availablePaise) / 100,
    lockedBalanceNumber: Number(lockedPaise) / 100,
    pendingDepositNumber: Number(pendingDepPaise) / 100,
    pendingWithdrawalNumber: Number(pendingWdrPaise) / 100,
    bonusBalanceNumber: Number(bonusPaise) / 100,
    totalDepositedNumber: Number(BigInt(wallet.totalDeposited || 0n)) / 100,
    totalWithdrawnNumber: Number(BigInt(wallet.totalWithdrawn || 0n)) / 100,
    totalWonNumber: Number(BigInt(wallet.totalWon || 0n)) / 100,
    totalLostNumber: Number(BigInt(wallet.totalLost || 0n)) / 100,
    user
  };
}

/**
 * Places a bet. Moves money from USER to SYSTEM:WAGER_RESERVE.
 * Enforces row-level locking (FOR UPDATE) and validates against available balance.
 */
async function placeBet(tx, userId, amountPaise, referenceType, referenceId) {
  const riskProfile = await tx.userRiskProfile.findUnique({ where: { userId } }).catch(() => null);
  if (riskProfile && riskProfile.isSuspended) {
    throw new Error("Account is restricted: Betting and financial actions are suspended.");
  }

  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');
  await ensureAccount(tx, 'SYSTEM:WAGER_RESERVE', 'LIABILITY');

  // Lock wallet row to prevent concurrent double-spends
  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }
  
  const wallet = wallets[0];
  const balancePaise = BigInt(wallet.balance);
  const lockedPaise = BigInt(wallet.lockedBalance || 0n);
  const availablePaise = balancePaise >= lockedPaise ? (balancePaise - lockedPaise) : 0n;

  if (availablePaise < amountPaise) {
    throw new Error(`Insufficient available balance in wallet. Available: ₹${(Number(availablePaise) / 100).toFixed(2)}, Required: ₹${(Number(amountPaise) / 100).toFixed(2)}`);
  }

  const newBalance = balancePaise - amountPaise;

  // 1. Update wallet balance
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

  emitWalletEvent(userId, 'WALLET_UPDATED', {
    userId,
    balance: Number(newBalance) / 100,
    availableBalance: Number(newBalance - lockedPaise) / 100,
    reason: 'BET_PLACE',
    referenceId
  });

  return newBalance;
}

/**
 * Settles a winning bet. Returns reserve to user and pays out from house revenue.
 */
async function settleWin(tx, userId, originalBetPaise, payoutPaise, referenceType, referenceId) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');
  await ensureAccount(tx, 'SYSTEM:WAGER_RESERVE', 'LIABILITY');
  await ensureAccount(tx, 'SYSTEM:REVENUE', 'REVENUE');

  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "totalWon" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "totalWon" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }

  const wallet = wallets[0];
  const newBalance = BigInt(wallet.balance) + payoutPaise;

  // 1. Update wallet balance and totalWon
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { 
      balance: newBalance,
      totalWon: { increment: payoutPaise }
    }
  });

  // 2. Ledger Entry 1: Return the original bet from Reserve -> User
  if (originalBetPaise > 0n) {
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
  }

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

  emitWalletEvent(userId, 'WALLET_UPDATED', {
    userId,
    balance: Number(newBalance) / 100,
    availableBalance: Number(newBalance - BigInt(wallet.lockedBalance || 0n)) / 100,
    reason: 'BET_WIN',
    referenceId
  });

  return newBalance;
}

/**
 * Settles a losing bet. Moves money from Wager Reserve to House Revenue.
 */
async function settleLoss(tx, userId, originalBetPaise, referenceType, referenceId) {
  await ensureAccount(tx, 'SYSTEM:WAGER_RESERVE', 'LIABILITY');
  await ensureAccount(tx, 'SYSTEM:REVENUE', 'REVENUE');

  await tx.wallet.updateMany({
    where: { userId, currency: 'INR' },
    data: { totalLost: { increment: originalBetPaise } }
  });

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
 */
async function refundBet(tx, userId, originalBetPaise, referenceType, referenceId) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');
  await ensureAccount(tx, 'SYSTEM:WAGER_RESERVE', 'LIABILITY');

  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
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

  emitWalletEvent(userId, 'WALLET_UPDATED', {
    userId,
    balance: Number(newBalance) / 100,
    availableBalance: Number(newBalance - BigInt(wallet.lockedBalance || 0n)) / 100,
    reason: 'REFUND',
    referenceId
  });

  return newBalance;
}

/**
 * ATOMIC WITHDRAWAL LOCK (Prompt #69 Phase 6 & 7)
 * Moves requested funds from available to locked/pending.
 * Guaranteed atomic check: available = balance - lockedBalance >= amount.
 */
async function lockFundsForWithdrawal(tx, userId, amountPaise, referenceId, destinationUpi) {
  const risk = await tx.userRiskProfile.findUnique({ where: { userId } }).catch(() => null);
  if (risk && risk.isSuspended) {
    throw new Error('Account is restricted: Financial actions and withdrawals are suspended.');
  }

  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');
  await ensureAccount(tx, 'SYSTEM:WITHDRAWAL_LIABILITY', 'LIABILITY');

  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "pendingWithdrawal" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "pendingWithdrawal" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }

  const wallet = wallets[0];
  const balancePaise = BigInt(wallet.balance);
  const lockedPaise = BigInt(wallet.lockedBalance || 0n);
  const availablePaise = balancePaise >= lockedPaise ? (balancePaise - lockedPaise) : 0n;

  if (availablePaise < amountPaise) {
    throw new Error(`Insufficient available balance! Available balance is ₹${(Number(availablePaise) / 100).toFixed(2)}`);
  }

  const newLocked = lockedPaise + amountPaise;
  const newPending = BigInt(wallet.pendingWithdrawal || 0n) + amountPaise;

  // 1. Move funds to locked / pending
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      lockedBalance: newLocked,
      pendingWithdrawal: newPending
    }
  });

  // 2. Double-entry ledger hold entry
  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `wdr-hold-${referenceId}`,
      referenceType: 'WITHDRAWAL',
      referenceId,
      debitAccountId: userAccountId,
      creditAccountId: 'SYSTEM:WITHDRAWAL_LIABILITY',
      amount: amountPaise,
      status: 'PENDING',
      auditMetadata: { destination: destinationUpi }
    }
  });

  // 3. Transaction record for player statement
  const txRecord = await tx.transaction.create({
    data: {
      walletId: wallet.id,
      idempotencyKey: `tx-wdr-hold-${referenceId}`,
      type: 'WITHDRAWAL',
      amount: amountPaise,
      balanceAfter: balancePaise - newLocked,
      reference: referenceId
    }
  });

  emitWalletEvent(userId, 'WITHDRAWAL_CREATED', {
    userId,
    referenceId,
    amount: Number(amountPaise) / 100,
    availableBalance: Number(balancePaise - newLocked) / 100,
    lockedBalance: Number(newLocked) / 100,
    status: 'PROCESSING'
  });

  return {
    walletId: wallet.id,
    transactionId: txRecord.id,
    referenceId,
    amountPaise,
    availableBalancePaise: balancePaise - newLocked,
    lockedBalancePaise: newLocked
  };
}

/**
 * REVERT WITHDRAWAL HOLD (Prompt #69 Phase 6)
 * If a withdrawal fails or is rejected, restores locked funds to available balance.
 */
async function revertWithdrawalHold(tx, userId, amountPaise, referenceId, reason) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');
  await ensureAccount(tx, 'SYSTEM:WITHDRAWAL_LIABILITY', 'LIABILITY');

  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "pendingWithdrawal" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) return;

  const wallet = wallets[0];
  const currentLocked = BigInt(wallet.lockedBalance || 0n);
  const currentPending = BigInt(wallet.pendingWithdrawal || 0n);

  const newLocked = currentLocked >= amountPaise ? (currentLocked - amountPaise) : 0n;
  const newPending = currentPending >= amountPaise ? (currentPending - amountPaise) : 0n;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      lockedBalance: newLocked,
      pendingWithdrawal: newPending
    }
  });

  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `wdr-revert-${referenceId}`,
      referenceType: 'REFUND',
      referenceId,
      debitAccountId: 'SYSTEM:WITHDRAWAL_LIABILITY',
      creditAccountId: userAccountId,
      amount: amountPaise,
      status: 'COMPLETED',
      auditMetadata: { reason }
    }
  });

  const available = BigInt(wallet.balance) - newLocked;
  emitWalletEvent(userId, 'WITHDRAWAL_REVERSED', {
    userId,
    referenceId,
    amount: Number(amountPaise) / 100,
    availableBalance: Number(available) / 100,
    lockedBalance: Number(newLocked) / 100,
    reason
  });
}

/**
 * FINALIZE WITHDRAWAL (Prompt #69 Phase 6)
 * When payment provider confirms payout success, permanently clears locked funds and decrements total balance.
 */
async function finalizeWithdrawal(tx, userId, amountPaise, referenceId) {
  await ensureAccount(tx, 'SYSTEM:WITHDRAWAL_LIABILITY', 'LIABILITY');
  await ensureAccount(tx, 'SYSTEM:EXTERNAL_BANK', 'ASSET');

  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "pendingWithdrawal", "totalWithdrawn" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) return;

  const wallet = wallets[0];
  const balancePaise = BigInt(wallet.balance);
  const lockedPaise = BigInt(wallet.lockedBalance || 0n);
  const pendingPaise = BigInt(wallet.pendingWithdrawal || 0n);

  const newBalance = balancePaise >= amountPaise ? (balancePaise - amountPaise) : 0n;
  const newLocked = lockedPaise >= amountPaise ? (lockedPaise - amountPaise) : 0n;
  const newPending = pendingPaise >= amountPaise ? (pendingPaise - amountPaise) : 0n;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: newBalance,
      lockedBalance: newLocked,
      pendingWithdrawal: newPending,
      totalWithdrawn: { increment: amountPaise }
    }
  });

  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: `wdr-settle-${referenceId}`,
      referenceType: 'WITHDRAWAL',
      referenceId,
      debitAccountId: 'SYSTEM:WITHDRAWAL_LIABILITY',
      creditAccountId: 'SYSTEM:EXTERNAL_BANK',
      amount: amountPaise,
      status: 'COMPLETED'
    }
  });

  emitWalletEvent(userId, 'WITHDRAWAL_COMPLETED', {
    userId,
    referenceId,
    amount: Number(amountPaise) / 100,
    balance: Number(newBalance) / 100,
    availableBalance: Number(newBalance - newLocked) / 100,
    status: 'COMPLETED'
  });
}

/**
 * ATOMIC DEPOSIT CREDIT (Prompt #69 Phase 5)
 * Credits user balance atomically from external bank clearing account with strict idempotency.
 */
async function creditDeposit(tx, userId, amountPaise, referenceId, provider = 'UPI', idempotencyKey = null) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, 'SYSTEM:EXTERNAL_BANK', 'ASSET');
  await ensureAccount(tx, userAccountId, 'USER');

  let wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "pendingDeposit", "totalDeposited" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) {
    await ensureUserAndWallet(tx, userId);
    wallets = await tx.$queryRaw`SELECT id, balance, "lockedBalance", "pendingDeposit", "totalDeposited" FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  }

  const wallet = wallets[0];
  const newBalance = BigInt(wallet.balance) + amountPaise;
  const currentPending = BigInt(wallet.pendingDeposit || 0n);
  const newPending = currentPending >= amountPaise ? (currentPending - amountPaise) : 0n;

  // 1. Update wallet balance and totalDeposited
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: newBalance,
      pendingDeposit: newPending,
      totalDeposited: { increment: amountPaise }
    }
  });

  // 2. Ledger double-entry
  const idemp = idempotencyKey || `dep-credit-${referenceId}`;
  await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: idemp,
      referenceType: 'DEPOSIT',
      referenceId,
      debitAccountId: 'SYSTEM:EXTERNAL_BANK',
      creditAccountId: userAccountId,
      amount: amountPaise,
      status: 'COMPLETED',
      auditMetadata: { provider }
    }
  });

  // 3. Transaction statement entry
  const txRecord = await tx.transaction.create({
    data: {
      walletId: wallet.id,
      idempotencyKey: `tx-${idemp}`,
      type: 'DEPOSIT',
      amount: amountPaise,
      balanceAfter: newBalance,
      reference: referenceId
    }
  });

  emitWalletEvent(userId, 'DEPOSIT_COMPLETED', {
    userId,
    referenceId,
    amount: Number(amountPaise) / 100,
    balance: Number(newBalance) / 100,
    availableBalance: Number(newBalance - BigInt(wallet.lockedBalance || 0n)) / 100,
    status: 'COMPLETED'
  });

  return {
    walletId: wallet.id,
    transactionId: txRecord.id,
    newBalancePaise: newBalance,
    newBalance: Number(newBalance) / 100
  };
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
  setIo,
  emitWalletEvent,
  getOrCreateUserAndWallet,
  ensureUserAndWallet,
  getWallet,
  placeBet,
  settleWin,
  settleLoss,
  refundBet,
  lockFundsForWithdrawal,
  revertWithdrawalHold,
  finalizeWithdrawal,
  creditDeposit,
  deductBalance,
  creditWinnings
};
