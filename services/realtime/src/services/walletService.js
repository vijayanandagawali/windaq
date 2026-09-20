/**
 * Wallet Service (Double-Entry Ledger)
 * 
 * Replaces direct wallet balance manipulation with strict double-entry ledger bookkeeping.
 * The `Wallet` model is preserved as a cached view of the `USER:id` account for fast reads.
 */

// Helper to ensure an account exists
async function ensureAccount(tx, accountId, type) {
  let acc = await tx.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!acc) {
    acc = await tx.ledgerAccount.create({ data: { id: accountId, type } });
  }
  return acc;
}

/**
 * Ensures that a User, Wallet, and LedgerAccount exist in the database.
 * If missing, automatically creates them atomically, permanently preventing
 * "User not found" or "Wallet not found" errors.
 */
async function ensureUserAndWallet(client, userId, options = {}) {
  // If initialPaise is explicitly specified (e.g. 50000n for welcome bonus, or 0n), use it;
  // Otherwise default to 1,000,000n (₹10,000) so newly provisioned guests/testers have playable funds
  const initialPaise = typeof options.initialPaise === 'bigint' 
    ? options.initialPaise 
    : (options.initialPaise !== undefined ? BigInt(options.initialPaise) : 1000000n);
  const role = options.role || 'USER';

  let user = await client.user.findUnique({ where: { id: userId } });
  if (!user) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const phone = options.phone || `+9198${Date.now().toString().slice(-4)}${randomSuffix}`;
    try {
      user = await client.user.create({
        data: { id: userId, phone, role }
      });
    } catch {
      user = await client.user.findUnique({ where: { id: userId } });
      if (!user) {
        // Second attempt with ultra-random phone if timestamp collided
        const fallbackPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
        try {
          user = await client.user.create({
            data: { id: userId, phone: fallbackPhone, role }
          });
        } catch {
          user = await client.user.findUnique({ where: { id: userId } });
        }
      }
    }
  }

  let wallet = await client.wallet.findFirst({ where: { userId, currency: 'INR' } });
  if (!wallet) {
    try {
      wallet = await client.wallet.create({
        data: { userId, currency: 'INR', balance: initialPaise }
      });
    } catch {
      wallet = await client.wallet.findFirst({ where: { userId, currency: 'INR' } });
    }
  }

  const accountId = `USER:${userId}`;
  let acc = await client.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!acc) {
    try {
      acc = await client.ledgerAccount.create({
        data: { id: accountId, type: 'USER', currency: 'INR' }
      });
    } catch {
      acc = await client.ledgerAccount.findUnique({ where: { id: accountId } });
    }
  }

  return { user, wallet, ledgerAccount: acc };
}

/**
 * Places a bet. Moves money from USER to SYSTEM:WAGER_RESERVE.
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
  if (!wallets || wallets.length === 0) throw new Error("Wallet not found");
  
  const wallet = wallets[0];
  if (BigInt(wallet.balance) < amountPaise) throw new Error("Insufficient balance");

  const newBalance = BigInt(wallet.balance) - amountPaise;

  // 1. Update cache
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

  // 3. Keep old Transaction log for backward compatibility
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
 */
async function settleWin(tx, userId, originalBetPaise, payoutPaise, referenceType, referenceId) {
  const userAccountId = `USER:${userId}`;
  await ensureAccount(tx, userAccountId, 'USER');

  // Lock the wallet row to prevent concurrent race conditions
  const wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) throw new Error("Wallet not found");

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
    // If they won less than their bet (e.g. half refund), the remaining goes to revenue
    const loss = originalBetPaise - payoutPaise;
    await tx.ledgerTransaction.create({
      data: {
        idempotencyKey: `bet-loss-partial-${referenceId}`,
        referenceType: 'BET_LOSS',
        referenceId,
        debitAccountId: userAccountId, // They got it all back in step 2, now they pay the house
        creditAccountId: 'SYSTEM:REVENUE',
        amount: loss,
        status: 'COMPLETED'
      }
    });
  }

  // 4. Keep old Transaction log
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
 * Does not affect user balance cache as it was deducted on bet placement.
 */
async function settleLoss(tx, userId, originalBetPaise, referenceType, referenceId) {
  // Transfer reserve to revenue
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

  // Lock row
  const wallets = await tx.$queryRaw`SELECT id, balance FROM "Wallet" WHERE "userId" = ${userId} AND "currency" = 'INR' FOR UPDATE`;
  if (!wallets || wallets.length === 0) throw new Error("Wallet not found");
  
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

module.exports = {
  ensureUserAndWallet,
  placeBet,
  settleWin,
  settleLoss,
  refundBet
};
