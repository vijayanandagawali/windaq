const crypto = require('crypto');
const { generateGameHash, calculateCrashPoint } = require('@windaq/provably-fair');
const { redisClient } = require('../config/redisClient');
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('./engine/UniversalRoundEngine');
const { PrismaClient } = require('@prisma/client');
const walletService = require('./walletService');

const prisma = new PrismaClient();
const MAX_BET_SLOTS = 2;
const MIN_AUTO_CASHOUT = 1.01;
const MAX_AUTO_CASHOUT = 1000;

class AviatorBetError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

class AviatorEngine extends UniversalRoundEngine {
  constructor(io) {
    const customDurations = {
      CREATED: 1,
      BETTING_OPEN: 6,   // 6 sec countdown for bets
      BETTING_CLOSED: 1, // Lock bets
      PLAYING: 10,       // Estimated max flight window
      RESULT: 3,         // Crash display
      SETTLEMENT: 2,     // Settle bets
      COMPLETED: 1,
      NEXT_ROUND: 1
    };

    super('aviator', 'default', io, customDurations);
    this.io = io;
    this.multiplier = 1.00;
    this.crashPoint = 1.00;
    this.tickRateMs = 100;
    this.flyInterval = null;
    this.isFlying = false;
    // Server-authoritative bet book: betId -> bet
    this.bets = new Map();
  }

  // --- SERVER-AUTHORITATIVE BETTING ---

  static betId(roundId, userId, slot) {
    return `AVB-${roundId}-${userId}-${slot}`;
  }

  isBettingWindowOpen() {
    return !this.isFlying && (
      this.currentPhase === UNIVERSAL_PHASES.CREATED ||
      this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN
    );
  }

  /**
   * Places a bet for the current round. The stake is debited through the ledgered wallet
   * service (row lock + idempotency key derived from round/user/slot).
   */
  async placeBet(userId, { amount, slot = 0, autoCashout } = {}) {
    const amountNum = Number(amount);
    const slotNum = Number(slot);
    if (!Number.isInteger(slotNum) || slotNum < 0 || slotNum >= MAX_BET_SLOTS) {
      throw new AviatorBetError('INVALID_SLOT', 'Invalid bet slot.');
    }
    if (!Number.isFinite(amountNum) || amountNum < this.minBet || amountNum > this.maxBet) {
      throw new AviatorBetError('INVALID_AMOUNT', `Bet must be between ₹${this.minBet} and ₹${this.maxBet}.`);
    }
    if (!Number.isInteger(Math.round(amountNum * 100)) || Math.abs(Math.round(amountNum * 100) - amountNum * 100) > 1e-6) {
      throw new AviatorBetError('INVALID_AMOUNT', 'Bet amount can have at most 2 decimal places.');
    }

    let auto = null;
    if (autoCashout !== undefined && autoCashout !== null && Number(autoCashout) > 0) {
      auto = Number(autoCashout);
      if (!Number.isFinite(auto) || auto < MIN_AUTO_CASHOUT || auto > MAX_AUTO_CASHOUT) {
        throw new AviatorBetError('INVALID_AUTO_CASHOUT', `Auto cashout must be between ${MIN_AUTO_CASHOUT}x and ${MAX_AUTO_CASHOUT}x.`);
      }
      auto = Math.floor(auto * 100) / 100;
    }

    if (!this.isBettingWindowOpen()) {
      throw new AviatorBetError('BETTING_CLOSED', 'Betting is closed for this round. Please wait for the next round.');
    }

    const roundId = this.roundId;
    const betId = AviatorEngine.betId(roundId, userId, slotNum);
    if (this.bets.has(betId)) {
      throw new AviatorBetError('DUPLICATE_BET', 'You already have a bet in this slot for this round.');
    }

    const amountPaise = BigInt(Math.round(amountNum * 100));
    const bet = { betId, roundId, userId, slot: slotNum, amountPaise, autoCashout: auto, status: 'PLACING' };
    this.bets.set(betId, bet); // reserve the slot synchronously to block concurrent duplicates

    let newBalance;
    try {
      newBalance = await prisma.$transaction((tx) =>
        walletService.placeBet(tx, userId, amountPaise, 'AVIATOR_BET', betId)
      );
    } catch (err) {
      this.bets.delete(betId);
      throw err;
    }

    // The round may have advanced while the DB write was in flight: refund instead of accepting.
    if (this.roundId !== roundId || !this.isBettingWindowOpen()) {
      bet.status = 'REFUNDING';
      await prisma.$transaction((tx) =>
        walletService.refundBet(tx, userId, amountPaise, 'AVIATOR_REFUND', betId)
      );
      bet.status = 'REFUNDED';
      throw new AviatorBetError('BETTING_CLOSED', 'Betting closed before your bet was accepted. Your stake was refunded.');
    }

    bet.status = 'ACTIVE';
    return { betId, roundId, slot: slotNum, amount: amountNum, autoCashout: auto, newBalance: Number(newBalance) / 100 };
  }

  /**
   * Cashes out an active bet at the SERVER's current multiplier.
   * Client-supplied amounts or multipliers are never used.
   */
  async cashout(userId, { slot = 0 } = {}, atMultiplier = null) {
    const slotNum = Number(slot);
    const betId = AviatorEngine.betId(this.roundId, userId, slotNum);
    const bet = this.bets.get(betId);
    if (!bet || bet.userId !== userId) {
      throw new AviatorBetError('NO_ACTIVE_BET', 'No active bet to cash out.');
    }
    if (bet.status !== 'ACTIVE') {
      throw new AviatorBetError('ALREADY_SETTLED', 'This bet has already been cashed out or settled.');
    }

    const current = atMultiplier !== null ? atMultiplier : this.multiplier;
    if (!this.isFlying || current >= this.crashPoint) {
      throw new AviatorBetError('NOT_FLYING', 'Cashout is only possible while the plane is flying.');
    }

    // Lock the bet synchronously before any await to prevent double cashout.
    bet.status = 'CASHING_OUT';
    const multiplierHundredths = BigInt(Math.floor(current * 100));
    const payoutPaise = (bet.amountPaise * multiplierHundredths) / 100n;

    try {
      const newBalance = await prisma.$transaction((tx) =>
        walletService.settleWin(tx, userId, bet.amountPaise, payoutPaise, 'AVIATOR_WIN', betId)
      );
      bet.status = 'CASHED_OUT';
      bet.cashoutMultiplier = Number(multiplierHundredths) / 100;
      bet.payoutPaise = payoutPaise;
      return {
        betId,
        slot: slotNum,
        multiplier: bet.cashoutMultiplier,
        payout: Number(payoutPaise) / 100,
        newBalance: Number(newBalance) / 100
      };
    } catch (err) {
      // Settlement failed: keep the bet ACTIVE so round-end settlement handles it.
      // Ledger idempotency keys (bet-win-<betId>) prevent any double payment.
      bet.status = 'ACTIVE';
      throw err;
    }
  }

  getUserBets(userId) {
    return [...this.bets.values()]
      .filter(b => b.userId === userId && b.roundId === this.roundId)
      .map(b => ({
        slot: b.slot,
        amount: Number(b.amountPaise) / 100,
        status: b.status,
        autoCashout: b.autoCashout,
        cashoutMultiplier: b.cashoutMultiplier || null
      }));
  }

  /**
   * Triggers auto cashouts whose target has been reached. On the crash tick, targets strictly
   * below the crash point are honoured even if the multiplier jumped past them between ticks.
   */
  processAutoCashouts(isCrashTick = false) {
    for (const bet of this.bets.values()) {
      if (bet.status !== 'ACTIVE' || !bet.autoCashout || bet.roundId !== this.roundId) continue;
      const reached = isCrashTick ? bet.autoCashout < this.crashPoint : this.multiplier >= bet.autoCashout;
      if (reached) {
        this.cashout(bet.userId, { slot: bet.slot }, bet.autoCashout)
          .then((result) => this.io.to(`user:${bet.userId}`).emit('aviator:cashout_result', { success: true, auto: true, ...result }))
          .catch((err) => console.error('[AviatorEngine] Auto cashout failed:', bet.betId, err.message));
      }
    }
  }

  /**
   * Settles every bet still ACTIVE after the crash as a loss (wager reserve -> revenue).
   */
  async settleRoundLosses(roundId) {
    for (const bet of this.bets.values()) {
      if (bet.roundId !== roundId || bet.status !== 'ACTIVE') continue;
      bet.status = 'SETTLING_LOSS';
      try {
        await prisma.$transaction((tx) =>
          walletService.settleLoss(tx, bet.userId, bet.amountPaise, 'AVIATOR_LOSS', bet.betId)
        );
        bet.status = 'LOST';
      } catch (err) {
        bet.status = 'ACTIVE';
        console.error('[AviatorEngine] Loss settlement failed:', bet.betId, err.message);
      }
    }
    // Drop finished bets from earlier rounds; failed ones stay visible for retry/reconciliation.
    for (const [id, bet] of this.bets) {
      if (bet.roundId !== roundId && ['LOST', 'CASHED_OUT', 'REFUNDED'].includes(bet.status)) this.bets.delete(id);
    }
  }

  startLoop() {
    this.start();
  }

  // --- UNIVERSAL ENGINE HOOKS ---

  async onCreateRound(roundId) {
    this.multiplier = 1.00;
    this.nonce++;

    // Generate crash point using Provably Fair algorithm
    const gameHash = generateGameHash(this.serverSeed, `${this.clientSeed || '0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c'}:${this.nonce}`);
    this.crashPoint = calculateCrashPoint(gameHash);
  }

  async onBettingOpen(roundId) {
    this.multiplier = 1.00;
  }

  async onBettingClosed(roundId) {}
  async onBettingLocked(roundId) { return this.onBettingClosed(roundId); }

  async onPlay(roundId) {
    this.io.to('aviator').emit('aviator:start', { roundId });
    this.multiplier = 1.00;

    // Fast sub-second multiplier loop
    this.isFlying = true;
    return new Promise((resolve) => {
      this.flyInterval = setInterval(async () => {
        this.multiplier += 0.01 * this.multiplier + 0.005;

        if (this.multiplier >= this.crashPoint) {
          this.processAutoCashouts(true);
          this.isFlying = false;
          clearInterval(this.flyInterval);
          this.flyInterval = null;
          resolve({ crashPoint: this.crashPoint });
        } else {
          this.processAutoCashouts();
          const currentMultiplier = this.multiplier.toFixed(2);
          this.io.to('aviator').emit('aviator:tick', { multiplier: currentMultiplier });
          if (redisClient?.set) {
            await redisClient.set('aviator:current_multiplier', currentMultiplier).catch(() => {});
          }
        }
      }, this.tickRateMs);
    });
  }

  async onResult(roundId) {
    const finalMultiplier = this.crashPoint.toFixed(2);

    this.io.to('aviator').emit('aviator:crashed', {
      roundId,
      multiplier: finalMultiplier,
      serverSeed: this.serverSeed,
      clientSeed: this.clientSeed,
      nonce: this.nonce
    });

    return { crashPoint: parseFloat(finalMultiplier) };
  }

  async onSettlement(roundId, result) {
    await this.settleRoundLosses(roundId);
  }
  async onCompleted(roundId, result) {}
  async onNextRound() {
    if (this.flyInterval) {
      clearInterval(this.flyInterval);
      this.flyInterval = null;
    }
  }

  async loop() {
    while (this.isRunning) {
      try {
        const now = Date.now();
        this.phaseTimeLeft = Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));

        // When in BETTING_OPEN, emit countdown for legacy aviator client
        if (this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN) {
          this.io.to('aviator').emit('aviator:waiting', {
            countdown: this.phaseTimeLeft,
            hash: this.serverSeedHash,
            roundId: this.roundId
          });
        }

        if (now >= this.phaseEndsAt && this.currentPhase !== UNIVERSAL_PHASES.PLAYING) {
          await this.handlePhaseTransition();
        } else if (this.currentPhase === UNIVERSAL_PHASES.PLAYING && !this.flyInterval) {
          // Trigger flight
          await this.handlePhaseTransition();
        }

        const tickPayload = {
          roundId: this.roundId,
          gameId: 'aviator',
          room: 'default',
          phase: this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          serverSeedHash: this.serverSeedHash,
          result: this.currentResult,
          history: this.history.slice(0, 20)
        };

        this.emitEvent('round:tick', tickPayload);

      } catch (err) {
        console.error('[AviatorEngine] Error in loop:', err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = AviatorEngine;
module.exports.AviatorBetError = AviatorBetError;
