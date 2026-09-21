const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const provablyFair = require('../ProvablyFairService');
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('../engine/UniversalRoundEngine');
const walletService = require('../walletService');

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

// Payout Matrix (multiplier of stake, excluding original stake return)
const PAYOUTS = {
  STRAIGHT: 35, // 35:1
  SPLIT: 17,
  STREET: 11,
  CORNER: 8,
  LINE: 5,
  COLUMN: 2,
  DOZEN: 2,
  RED: 1,
  BLACK: 1,
  EVEN: 1,
  ODD: 1,
  HIGH: 1,
  LOW: 1
};

class RouletteEngine extends UniversalRoundEngine {
  constructor(room = 'Auto', coreManager) {
    const customDurations = {
      CREATED: 1,
      BETTING_OPEN: 15,
      BETTING_CLOSING: 3,
      BETTING_LOCKED: 2,
      PLAYING: 6,       // Wheel spinning cinematic animation
      RESULT_REVEAL: 3, // Winning number highlight
      SETTLEMENT: 2,   // Atomic wallet payout
      COMPLETED: 1,
      NEXT_ROUND: 1
    };

    super('roulette', room, coreManager, customDurations);
    this.coreManager = coreManager;
    this.legacyRoll = null;
  }

  // --- SUBCLASS UNIVERSAL HOOKS ---

  async onCreateRound(roundId) {
    try {
      const startTime = new Date();
      const lockTime = new Date(startTime.getTime() + (18 * 1000));
      const resultTime = new Date(lockTime.getTime() + (8 * 1000));

      // Create legacy DB record for backward compatibility
      this.legacyRoll = await prisma.rouletteRoll.create({
        data: {
          id: roundId,
          room: this.room,
          status: 'OPEN',
          serverSeed: this.serverSeed,
          serverSeedHash: this.serverSeedHash,
          clientSeed: '',
          startTime,
          lockTime,
          resultTime
        }
      });
      console.log(`[RouletteEngine:${this.room}] Created round ${roundId}`);
    } catch (err) {
      console.error(`[RouletteEngine:${this.room}] DB create error:`, err.message);
    }
  }

  async onBettingOpen(roundId) {
    this.emitLegacyTick();
  }

  async onBettingClosing(roundId) {
    this.emitLegacyTick();
  }

  async onBettingLocked(roundId) {
    if (this.legacyRoll) {
      await prisma.rouletteRoll.update({
        where: { id: this.legacyRoll.id },
        data: { status: 'LOCKED' }
      }).catch(() => {});
    }
    this.emitEvent('roulette:locked', { roundId });
  }

  async onPlay(roundId) {
    this.animationState = {
      action: 'SPINNING',
      durationSeconds: this.phaseDurations.PLAYING
    };
    this.emitEvent('WHEEL_STARTED', { roundId, durationSeconds: this.phaseDurations.PLAYING });
    this.emitEvent('roulette:spinning', { roundId, durationSeconds: this.phaseDurations.PLAYING });
  }

  async onResult(roundId) {
    const pfResult = provablyFair.deriveRouletteResult(this.serverSeed, this.clientSeed, 0);
    const resultNumber = pfResult.outcome;
    const isRed = RED_NUMBERS.includes(resultNumber);
    const color = resultNumber === 0 ? 'green' : (isRed ? 'red' : 'black');

    const result = {
      resultNumber,
      color,
      isEven: resultNumber !== 0 && resultNumber % 2 === 0,
      isHigh: resultNumber >= 19,
      dozen: resultNumber === 0 ? null : Math.ceil(resultNumber / 12)
    };

    if (this.legacyRoll) {
      await prisma.rouletteRoll.update({
        where: { id: this.legacyRoll.id },
        data: {
          status: 'RESULT',
          clientSeed: this.clientSeed,
          resultNumber
        }
      }).catch(() => {});
    }

    this.emitEvent('roulette:result', {
      roundId,
      resultNumber,
      color,
      serverSeed: this.serverSeed,
      clientSeed: this.clientSeed
    });

    return result;
  }

  evaluateBet(bet, resultNumber) {
    const targets = bet.targets; 
    if (Array.isArray(targets) && targets.includes(resultNumber)) {
       const multiplier = PAYOUTS[bet.marketType] || 0;
       return multiplier + 1; // +1 includes original stake return
    }
    return 0;
  }

  async onSettlement(roundId, result) {
    if (!result) return;
    const winningNumber = result.resultNumber;

    try {
      const bets = await prisma.rouletteBet.findMany({ where: { rollId: roundId } });
      let totalPayout = 0n;
      let winnersCount = 0;

      for (const bet of bets) {
        const payoutMultiplier = this.evaluateBet(bet, winningNumber);

        if (payoutMultiplier > 0) {
          const payout = BigInt(Math.floor(Number(bet.amount) * payoutMultiplier));
          totalPayout += payout;
          winnersCount++;

          await prisma.$transaction(async (tx) => {
            await tx.rouletteBet.update({
              where: { id: bet.id },
              data: { payout }
            });

            // Universal Settlement Engine integration with exactly-once ledger transaction
            await walletService.settleWin(tx, bet.userId, bet.amount, payout, 'ROULETTE_WIN', bet.id);
          });
        }
      }

      this.totalPayoutPaise = totalPayout;

      if (this.legacyRoll) {
        await prisma.rouletteRoll.update({
          where: { id: this.legacyRoll.id },
          data: { status: 'SETTLED' }
        }).catch(() => {});
      }

      this.emitEvent('roulette:settled', {
        roundId,
        betsCount: bets.length,
        winnersCount,
        totalPayout: totalPayout.toString()
      });

      console.log(`[RouletteEngine:${this.room}] Settled ${roundId}. Bets: ${bets.length}, Winners: ${winnersCount}, Number: ${winningNumber}`);
    } catch (err) {
      console.error(`[RouletteEngine:${this.room}] Settlement error:`, err.message);
    }
  }

  async onCompleted(roundId, result) {
    // Handled by UniversalRoundEngine base class
  }

  async onNextRound() {
    this.animationState = null;
  }

  emitLegacyTick() {
    this.emitEvent('roulette:tick', {
      roundId: this.roundId,
      status: this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN ? 'OPEN' : this.currentPhase,
      phase: this.currentPhase,
      lockTime: this.phaseEndsAt,
      resultTime: this.phaseEndsAt + 8000,
      now: Date.now(),
      timeLeft: this.phaseTimeLeft
    });
  }
}

module.exports = { RouletteEngine };
