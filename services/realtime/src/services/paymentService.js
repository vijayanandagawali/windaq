const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mockUpiAdapter = require('./paymentAdapters/mockUpiAdapter');
const bonusService = require('./bonusService');

async function ensureAccount(tx, accountId, type) {
  let acc = await tx.ledgerAccount.findUnique({ where: { id: accountId } });
  if (!acc) {
    acc = await tx.ledgerAccount.create({ data: { id: accountId, type } });
  }
  return acc;
}

// We use a Map to quickly route provider names to their respective adapters.
const ADAPTERS = {
  'MOCK_UPI': mockUpiAdapter
};

class PaymentService {

  /**
   * Orchestrates a Deposit Initiation
   */
  async createDepositIntent(userId, amountPaise, providerName) {
    const adapter = ADAPTERS[providerName];
    if (!adapter) throw new Error(`Unsupported provider: ${providerName}`);

    // Create the PENDING intent first to secure the ID
    const intent = await prisma.paymentIntent.create({
      data: {
        userId,
        amount: amountPaise,
        type: 'DEPOSIT',
        provider: providerName,
        status: 'INITIATED'
      }
    });

    try {
      const response = await adapter.initiateDeposit(amountPaise, intent.id);
      
      if (response.success) {
        return await prisma.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: 'PENDING',
            providerReference: response.providerReference,
            metadata: response.metadata
          }
        });
      } else {
        throw new Error(response.message || 'Provider initiation failed');
      }
    } catch (err) {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'FAILED', metadata: { error: err.message } }
      });
      throw err;
    }
  }

  /**
   * Orchestrates a Withdrawal Request (incorporating Review/Risk Checks)
   */
  async requestWithdrawal(userId, amountPaise, providerName, destinationInfo) {
    const adapter = ADAPTERS[providerName];
    if (!adapter) throw new Error(`Unsupported provider: ${providerName}`);

    // Check balance
    const wallet = await prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'INR' } } });
    if (!wallet || wallet.balance < amountPaise) {
      throw new Error('Insufficient funds for withdrawal.');
    }

    // Forfeit any active bonuses
    await bonusService.cancelBonus(userId);

    // Determine Risk/Review Gate
    // If > 10,000 INR, send to PENDING_REVIEW, else Auto-Process.
    const isHighValue = amountPaise > 1000000n; // 10k INR
    const initialStatus = isHighValue ? 'PENDING_REVIEW' : 'PENDING';

    const intent = await prisma.paymentIntent.create({
      data: {
        userId,
        amount: amountPaise,
        type: 'WITHDRAWAL',
        provider: providerName,
        status: initialStatus,
        metadata: { destination: destinationInfo }
      }
    });

    // Debit the user's wallet immediately, place in Liability/Pending account
    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amountPaise } }
      });

      const userAccountId = `USER:${userId}`;
      await ensureAccount(tx, userAccountId, 'USER');
      await ensureAccount(tx, 'SYSTEM:WITHDRAWAL_LIABILITY', 'LIABILITY');
      
      await tx.ledgerTransaction.create({
        data: {
          idempotencyKey: `withdraw-hold-${intent.id}`,
          referenceType: 'WITHDRAWAL',
          referenceId: intent.id,
          debitAccountId: userAccountId,
          creditAccountId: 'SYSTEM:WITHDRAWAL_LIABILITY',
          amount: amountPaise,
          status: 'COMPLETED'
        }
      });
    });

    if (initialStatus === 'PENDING') {
      // Auto-process
      await this._executeWithdrawalAdapter(intent.id, adapter, amountPaise, destinationInfo);
    }

    return intent;
  }

  /**
   * Admin approves a PENDING_REVIEW withdrawal
   */
  async approveWithdrawal(intentId, adminId) {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.status !== 'PENDING_REVIEW') throw new Error('Invalid intent state');

    const adapter = ADAPTERS[intent.provider];
    await this._executeWithdrawalAdapter(intent.id, adapter, intent.amount, intent.metadata.destination);
    
    return true;
  }

  async _executeWithdrawalAdapter(intentId, adapter, amountPaise, destinationInfo) {
    const response = await adapter.initiateWithdrawal(amountPaise, destinationInfo);
    if (response.success) {
      await prisma.paymentIntent.update({
        where: { id: intentId },
        data: { status: 'PENDING', providerReference: response.providerReference }
      });
    } else {
      // Reversal logic
      await this.handleFailedPayment(intentId, response.message);
    }
  }

  /**
   * Idempotent Webhook Handler for Webhook Callbacks (Provider -> System)
   * The single authoritative source of truth.
   */
  async handleWebhookCallback(providerName, payload, signature) {
    const adapter = ADAPTERS[providerName];
    if (!adapter) throw new Error('Invalid provider');

    if (!adapter.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const { providerReference, status } = payload;
    
    const intent = await prisma.paymentIntent.findUnique({
      where: { providerReference }
    });

    if (!intent) throw new Error('Intent not found');
    
    // Idempotency check: if already processed, return OK to provider to stop retries
    if (intent.status === 'SUCCESS' || intent.status === 'FAILED') {
      return { success: true, message: 'Already processed (Idempotent)' };
    }

    if (status === 'SUCCESS') {
      await this._settleSuccess(intent);
    } else if (status === 'FAILED' || status === 'EXPIRED') {
      await this.handleFailedPayment(intent.id, 'Webhook reported failure');
    }

    return { success: true };
  }

  /**
   * Finalizes a successful payment in the Ledger.
   */
  async _settleSuccess(intent) {
    await prisma.$transaction(async (tx) => {
      // 1. Mark Intent SUCCESS
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'SUCCESS' }
      });

      const userAccountId = `USER:${intent.userId}`;

      // 2. Ledger Entry
      if (intent.type === 'DEPOSIT') {
        await ensureAccount(tx, 'SYSTEM:EXTERNAL_BANK', 'ASSET');
        await ensureAccount(tx, userAccountId, 'USER');
        // Mint funds from External Bank to User Account
        await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: `deposit-settle-${intent.id}`,
            referenceType: 'DEPOSIT',
            referenceId: intent.id,
            debitAccountId: 'SYSTEM:EXTERNAL_BANK',
            creditAccountId: userAccountId,
            amount: intent.amount,
            status: 'COMPLETED'
          }
        });

        // Update cache
        await tx.wallet.update({
          where: { userId_currency: { userId: intent.userId, currency: 'INR' } },
          data: { balance: { increment: intent.amount } }
        });
      } else if (intent.type === 'WITHDRAWAL') {
        await ensureAccount(tx, 'SYSTEM:WITHDRAWAL_LIABILITY', 'LIABILITY');
        await ensureAccount(tx, 'SYSTEM:EXTERNAL_BANK', 'ASSET');
        // Finalize withdrawal from Liability to External Bank
        await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: `withdraw-settle-${intent.id}`,
            referenceType: 'WITHDRAWAL',
            referenceId: intent.id,
            debitAccountId: 'SYSTEM:WITHDRAWAL_LIABILITY',
            creditAccountId: 'SYSTEM:EXTERNAL_BANK',
            amount: intent.amount,
            status: 'COMPLETED'
          }
        });
      }
    });
  }

  /**
   * Handles payment failure and reversals (e.g. returning funds to user if withdrawal fails)
   */
  async handleFailedPayment(intentId, reason) {
    const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent || (intent.status !== 'PENDING' && intent.status !== 'PENDING_REVIEW')) return;

    await prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'FAILED', metadata: { ...(intent.metadata || {}), error: reason } }
      });

      // If it was a withdrawal, reverse the hold
      if (intent.type === 'WITHDRAWAL') {
        const userAccountId = `USER:${intent.userId}`;
        await ensureAccount(tx, 'SYSTEM:WITHDRAWAL_LIABILITY', 'LIABILITY');
        await ensureAccount(tx, userAccountId, 'USER');
        
        await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: `withdraw-reversal-${intent.id}`,
            referenceType: 'REFUND',
            referenceId: intent.id,
            debitAccountId: 'SYSTEM:WITHDRAWAL_LIABILITY',
            creditAccountId: userAccountId,
            amount: intent.amount,
            status: 'COMPLETED'
          }
        });

        await tx.wallet.update({
          where: { userId_currency: { userId: intent.userId, currency: 'INR' } },
          data: { balance: { increment: intent.amount } }
        });
      }
    });
  }
}

module.exports = new PaymentService();
