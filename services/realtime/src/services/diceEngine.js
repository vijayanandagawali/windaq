const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const provablyFair = require('./ProvablyFairService');
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('./engine/UniversalRoundEngine');

// Sic Bo Payout Multipliers
const PAYOUTS = {
  'SMALL': 2,        // 1:1
  'BIG': 2,          // 1:1
  'ODD': 2,          // 1:1
  'EVEN': 2,         // 1:1
  'TRIPLE_ANY': 25,  // 24:1
  'TRIPLE_1': 151,   // 150:1
  'TRIPLE_2': 151,
  'TRIPLE_3': 151,
  'TRIPLE_4': 151,
  'TRIPLE_5': 151,
  'TRIPLE_6': 151,
  'SUM_4': 51,       // 50:1
  'SUM_17': 51,
  'SUM_5': 19,       // 18:1
  'SUM_16': 19,
  'SUM_6': 15,       // 14:1
  'SUM_15': 15,
  'SUM_7': 13,       // 12:1
  'SUM_14': 13,
  'SUM_8': 9,        // 8:1
  'SUM_13': 9,
  'SUM_9': 7,        // 6:1
  'SUM_12': 7,
  'SUM_10': 7,       // 6:1
  'SUM_11': 7,
};

class DiceEngine extends UniversalRoundEngine {
  constructor(room = '1min', io) {
    const customDurations = {
      CREATED: 1,
      BETTING_OPEN: 45,
      BETTING_CLOSED: 5,
      PLAYING: 3,
      RESULT: 3,
      SETTLEMENT: 2,
      COMPLETED: 1,
      NEXT_ROUND: 1
    };

    super('dice', room, io, customDurations);
    this.io = io;
    this.currentRoll = null;
  }

  // --- UNIVERSAL ENGINE HOOKS ---

  async onCreateRound(roundId) {
    try {
      const startTime = new Date();
      const totalSeconds = Object.values(this.phaseDurations).reduce((a, b) => a + b, 0);
      const resultTime = new Date(startTime.getTime() + (totalSeconds * 1000));
      const lockTime = new Date(startTime.getTime() + (this.phaseDurations.BETTING_OPEN * 1000));

      this.currentRoll = await prisma.diceRoll.create({
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
      console.log(`[DiceEngine:${this.room}] Created roll ${roundId}`);
    } catch (err) {
      console.error(`[DiceEngine:${this.room}] DB create error:`, err.message);
    }
  }

  async onBettingOpen(roundId) {}

  async onBettingClosed(roundId) {
    if (this.currentRoll) {
      await prisma.diceRoll.update({
        where: { id: this.currentRoll.id },
        data: { status: 'LOCKED' }
      }).catch(err => console.error(`[DiceEngine] Lock error:`, err.message));
    }
    this.io.to(`dice:${this.room}`).emit('dice:locked', { rollId: roundId });
  }

  async onPlay(roundId) {
    this.io.to(`dice:${this.room}`).emit('dice:rolling', { rollId: roundId });
  }

  async onResult(roundId) {
    const resultObj = provablyFair.deriveDiceResult(this.serverSeed, this.clientSeed, 0);
    const dice = resultObj.outcome; // [1-6, 1-6, 1-6]

    if (this.currentRoll) {
      await prisma.diceRoll.update({
        where: { id: this.currentRoll.id },
        data: {
          status: 'RESULT',
          clientSeed: this.clientSeed,
          diceResult: dice
        }
      }).catch(err => console.error(`[DiceEngine] Result error:`, err.message));
    }

    this.io.to(`dice:${this.room}`).emit('dice:result', {
      rollId: roundId,
      dice,
      serverSeed: this.serverSeed
    });

    return { dice };
  }

  evaluateBet(bet, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    const isTriple = (dice[0] === dice[1] && dice[1] === dice[2]);
    const m = bet.market;

    if (m === 'TRIPLE_ANY') return isTriple ? PAYOUTS['TRIPLE_ANY'] : 0;
    if (m.startsWith('TRIPLE_')) {
      const num = parseInt(m.split('_')[1]);
      return (isTriple && dice[0] === num) ? PAYOUTS[m] : 0;
    }

    if (isTriple) return 0; // Standard Sic Bo: Triples lose Small/Big/Odd/Even

    if (m === 'SMALL') return (sum >= 4 && sum <= 10) ? PAYOUTS['SMALL'] : 0;
    if (m === 'BIG') return (sum >= 11 && sum <= 17) ? PAYOUTS['BIG'] : 0;
    if (m === 'ODD') return (sum % 2 !== 0) ? PAYOUTS['ODD'] : 0;
    if (m === 'EVEN') return (sum % 2 === 0) ? PAYOUTS['EVEN'] : 0;

    if (m.startsWith('SUM_')) {
      const targetSum = parseInt(m.split('_')[1]);
      return (sum === targetSum) ? (PAYOUTS[m] || 0) : 0;
    }

    return 0;
  }

  async onSettlement(roundId, result) {
    if (!this.currentRoll || !result) return;
    const dice = result.dice;

    try {
      const bets = await prisma.diceBet.findMany({ where: { rollId: this.currentRoll.id } });

      for (const bet of bets) {
        const multiplier = this.evaluateBet(bet, dice);

        if (multiplier > 0) {
          const payout = BigInt(Math.floor(Number(bet.amount) * multiplier));

          await prisma.$transaction(async (tx) => {
            await tx.diceBet.update({
              where: { id: bet.id },
              data: { payout }
            });

            const wallet = await tx.wallet.findFirst({ where: { userId: bet.userId, currency: 'INR' } });
            if (wallet) {
              const newBalance = wallet.balance + payout;
              await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

              await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  idempotencyKey: `dice-win-${bet.id}`,
                  type: 'BET_WIN',
                  amount: payout,
                  balanceAfter: newBalance,
                  reference: bet.id
                }
              });
            }
          });
        }
      }

      console.log(`[DiceEngine:${this.room}] Settled roll ${roundId}. Bets: ${bets.length}`);
    } catch (err) {
      console.error(`[DiceEngine:${this.room}] Settlement error:`, err.message);
    }
  }

  async onCompleted(roundId, result) {
    if (this.currentRoll) {
      await prisma.diceRoll.update({
        where: { id: this.currentRoll.id },
        data: { status: 'SETTLED' }
      }).catch(err => console.error(`[DiceEngine] Settle status error:`, err.message));
    }
  }

  async onNextRound() {}

  /**
   * Overwrite loop to emit dice:tick alongside round:tick
   */
  async loop() {
    while (this.isRunning) {
      try {
        const now = Date.now();
        this.phaseTimeLeft = Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));

        if (now >= this.phaseEndsAt) {
          await this.handlePhaseTransition();
        }

        const tickPayload = {
          roundId: this.roundId,
          rollId: this.roundId,
          gameId: 'dice',
          room: this.room,
          phase: this.currentPhase,
          status: this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN ? 'OPEN' : this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          lockTime: this.phaseEndsAt - 5000,
          resultTime: this.phaseEndsAt,
          now,
          serverSeedHash: this.serverSeedHash,
          result: this.currentResult,
          history: this.history.slice(0, 15)
        };

        this.io.to(`dice:${this.room}`).emit('dice:tick', tickPayload);
        this.emitEvent('round:tick', tickPayload);

      } catch (err) {
        console.error(`[DiceEngine:${this.room}] Error in loop:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { DiceEngine };
