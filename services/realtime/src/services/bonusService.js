const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

class BonusService {
  /**
   * Activates a campaign for a user, granting them a bonus balance.
   */
  async activateCampaign(userId, campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'ACTIVE') throw new Error('Campaign is not active');
    if (campaign.endDate && new Date() > campaign.endDate) throw new Error('Campaign has expired');

    // Prevent duplicate grants (idempotency/eligibility check)
    const existing = await prisma.bonusBalance.findUnique({
      where: { userId_campaignId: { userId, campaignId } }
    });
    if (existing) throw new Error('You have already claimed this promotion.');

    const config = campaign.config;
    // For NO_DEPOSIT bonuses, amount is fixed. For others, it might be dynamically calculated, but we'll use maxBonus for now.
    const bonusAmount = BigInt(config.maxBonus || 0);
    const wageringReqMultiplier = config.wageringReqMultiplier || 1;
    const wageringRequirement = bonusAmount * BigInt(wageringReqMultiplier);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (config.expiryDays || 7));

    return await prisma.$transaction(async (tx) => {
      const bonus = await tx.bonusBalance.create({
        data: {
          userId,
          campaignId,
          initialAmount: bonusAmount,
          currentAmount: bonusAmount,
          wageringRequirement,
          status: 'ACTIVE',
          expiresAt
        }
      });

      await tx.bonusLedgerTransaction.create({
        data: {
          idempotencyKey: `grant-${bonus.id}`,
          bonusBalanceId: bonus.id,
          type: 'GRANT',
          amount: bonusAmount
        }
      });

      return bonus;
    });
  }

  /**
   * Called during wager processing.
   * If a user has an active bonus balance, we deduct from that first.
   * Returns { deductedFromBonus: amount, remainingToDeductFromReal: amount }
   */
  async processBonusWager(userId, gameId, wagerAmountPaise, referenceId) {
    // Find active bonus
    const activeBonus = await prisma.bonusBalance.findFirst({
      where: { userId, status: 'ACTIVE', currentAmount: { gt: 0 } },
      include: { campaign: true }
    });

    if (!activeBonus) {
      return { deductedFromBonus: 0n, remainingToDeductFromReal: wagerAmountPaise };
    }

    // Check game restrictions
    const restrictedGames = activeBonus.campaign.config.restrictedGames || [];
    if (restrictedGames.includes(gameId)) {
      // Cannot use bonus on restricted games
      return { deductedFromBonus: 0n, remainingToDeductFromReal: wagerAmountPaise };
    }

    // Deduct up to the wagerAmountPaise
    const amountToDeduct = wagerAmountPaise > activeBonus.currentAmount 
      ? activeBonus.currentAmount 
      : wagerAmountPaise;

    await prisma.$transaction(async (tx) => {
      await tx.bonusBalance.update({
        where: { id: activeBonus.id },
        data: { 
          currentAmount: { decrement: amountToDeduct },
          wageredAmount: { increment: amountToDeduct }
        }
      });

      await tx.bonusLedgerTransaction.create({
        data: {
          idempotencyKey: `wager-${referenceId}-${activeBonus.id}`,
          bonusBalanceId: activeBonus.id,
          type: 'WAGER',
          amount: amountToDeduct,
          referenceId
        }
      });
    });

    return { 
      deductedFromBonus: amountToDeduct, 
      remainingToDeductFromReal: wagerAmountPaise - amountToDeduct 
    };
  }

  /**
   * Called during settlement if a wager won.
   * If the original wager used bonus funds, we credit the winnings back to the bonus balance.
   */
  async creditBonusWin(userId, payoutPaise, referenceId) {
    // Find the wager transaction to see if it used a bonus
    const wagerTx = await prisma.bonusLedgerTransaction.findFirst({
      where: { referenceId, type: 'WAGER' }
    });

    if (!wagerTx) return { creditedToBonus: 0n, remainingToCreditToReal: payoutPaise };

    const bonusId = wagerTx.bonusBalanceId;
    const bonus = await prisma.bonusBalance.findUnique({ where: { id: bonusId } });
    
    // If the bonus was already completed/cancelled, the win goes to real cash
    if (bonus.status !== 'ACTIVE') return { creditedToBonus: 0n, remainingToCreditToReal: payoutPaise };

    await prisma.$transaction(async (tx) => {
      await tx.bonusBalance.update({
        where: { id: bonusId },
        data: { currentAmount: { increment: payoutPaise } }
      });

      await tx.bonusLedgerTransaction.create({
        data: {
          idempotencyKey: `win-${referenceId}-${bonusId}`,
          bonusBalanceId: bonusId,
          type: 'WIN',
          amount: payoutPaise,
          referenceId
        }
      });
    });

    // Check if wagering requirement is met
    await this.checkConversion(bonusId);

    return { creditedToBonus: payoutPaise, remainingToCreditToReal: 0n };
  }

  /**
   * Converts bonus to real cash if requirement is met.
   */
  async checkConversion(bonusBalanceId) {
    const bonus = await prisma.bonusBalance.findUnique({ where: { id: bonusBalanceId } });
    if (!bonus || bonus.status !== 'ACTIVE') return;

    if (bonus.wageredAmount >= bonus.wageringRequirement) {
      // Conversion triggered
      const maxConvertible = BigInt(bonus.initialAmount) * 2n; // Custom logic: max convert is 2x initial
      const amountToConvert = bonus.currentAmount > maxConvertible ? maxConvertible : bonus.currentAmount;

      await prisma.$transaction(async (tx) => {
        // Mark as completed
        await tx.bonusBalance.update({
          where: { id: bonusBalanceId },
          data: { status: 'COMPLETED', currentAmount: 0n }
        });

        await tx.bonusLedgerTransaction.create({
          data: {
            idempotencyKey: `convert-${bonusBalanceId}`,
            bonusBalanceId,
            type: 'CONVERT_TO_CASH',
            amount: amountToConvert
          }
        });

        // Add to real wallet
        await tx.wallet.update({
          where: { userId_currency: { userId: bonus.userId, currency: 'INR' } },
          data: { balance: { increment: amountToConvert } }
        });

        // Add to Real Ledger
        let acc = await tx.ledgerAccount.findUnique({ where: { id: `USER:${bonus.userId}` } });
        if (!acc) await tx.ledgerAccount.create({ data: { id: `USER:${bonus.userId}`, type: 'USER' } });
        
        let sysAcc = await tx.ledgerAccount.findUnique({ where: { id: 'SYSTEM:PROMOTIONS' } });
        if (!sysAcc) await tx.ledgerAccount.create({ data: { id: 'SYSTEM:PROMOTIONS', type: 'EXPENSE' } });

        await tx.ledgerTransaction.create({
          data: {
            idempotencyKey: `ledger-convert-${bonusBalanceId}`,
            referenceType: 'DEPOSIT',
            referenceId: bonusBalanceId,
            debitAccountId: 'SYSTEM:PROMOTIONS',
            creditAccountId: `USER:${bonus.userId}`,
            amount: amountToConvert,
            status: 'COMPLETED'
          }
        });
      });
    }
  }

  /**
   * Cancels a bonus (e.g., if user attempts withdrawal)
   */
  async cancelBonus(userId) {
    const activeBonuses = await prisma.bonusBalance.findMany({
      where: { userId, status: 'ACTIVE' }
    });

    for (const b of activeBonuses) {
      await prisma.$transaction(async (tx) => {
        await tx.bonusBalance.update({
          where: { id: b.id },
          data: { status: 'CANCELLED', currentAmount: 0n }
        });

        await tx.bonusLedgerTransaction.create({
          data: {
            idempotencyKey: `cancel-${b.id}`,
            bonusBalanceId: b.id,
            type: 'CANCEL',
            amount: b.currentAmount
          }
        });
      });
    }
  }
}

module.exports = new BonusService();
