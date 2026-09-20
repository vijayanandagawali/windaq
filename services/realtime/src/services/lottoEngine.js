const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('./engine/UniversalRoundEngine');

// Payout structure for ₹100 stake (10000 paise)
const PAYOUTS = {
  3: 50000n,        // 500 INR
  4: 500000n,       // 5,000 INR
  5: 5000000n,      // 50,000 INR
  6: 1000000000n    // 10,000,000 INR (Jackpot)
};

class LottoEngine extends UniversalRoundEngine {
  constructor(room = '5min', io) {
    const customDurations = {
      CREATED: 1,
      BETTING_OPEN: 240, // 4 mins
      BETTING_CLOSED: 30, // 30 sec locked
      PLAYING: 15,       // Drawing balls
      RESULT: 5,         // Show numbers
      SETTLEMENT: 5,     // Payout tickets
      COMPLETED: 2,
      NEXT_ROUND: 2
    };

    super('lotto', room, io, customDurations);
    this.io = io;
    this.currentDraw = null;
  }

  // --- UNIVERSAL ENGINE HOOKS ---

  async onCreateRound(roundId) {
    try {
      const startTime = new Date();
      const totalSeconds = Object.values(this.phaseDurations).reduce((a, b) => a + b, 0);
      const resultTime = new Date(startTime.getTime() + (totalSeconds * 1000));
      const lockTime = new Date(startTime.getTime() + (this.phaseDurations.BETTING_OPEN * 1000));

      this.currentDraw = await prisma.lottoDraw.create({
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
      console.log(`[LottoEngine:${this.room}] Created draw ${roundId}`);
    } catch (err) {
      console.error(`[LottoEngine:${this.room}] DB create error:`, err.message);
    }
  }

  async onBettingOpen(roundId) {}

  async onBettingClosed(roundId) {
    if (this.currentDraw) {
      await prisma.lottoDraw.update({
        where: { id: this.currentDraw.id },
        data: { status: 'LOCKED' }
      }).catch(err => console.error(`[LottoEngine] Lock error:`, err.message));
    }
    this.io.to(`lotto:${this.room}`).emit('lotto:locked', { drawId: roundId });
  }

  async onPlay(roundId) {
    this.io.to(`lotto:${this.room}`).emit('lotto:drawing', { drawId: roundId });
  }

  async onResult(roundId) {
    // Generate 6 unique numbers (1-49)
    const numbers = [];
    let seed = this.serverSeed;
    while (numbers.length < 6) {
      const hash = crypto.createHmac('sha256', seed).update(this.clientSeed).digest('hex');
      const num = (parseInt(hash.substring(0, 8), 16) % 49) + 1;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
      seed = hash;
    }
    numbers.sort((a, b) => a - b);

    if (this.currentDraw) {
      await prisma.lottoDraw.update({
        where: { id: this.currentDraw.id },
        data: {
          status: 'RESULT',
          clientSeed: this.clientSeed,
          winningNumbers: numbers
        }
      }).catch(err => console.error(`[LottoEngine] Result save error:`, err.message));
    }

    this.io.to(`lotto:${this.room}`).emit('lotto:result', {
      drawId: roundId,
      winningNumbers: numbers,
      serverSeed: this.serverSeed
    });

    return { winningNumbers: numbers };
  }

  async onSettlement(roundId, result) {
    if (!this.currentDraw || !result) return;
    const winningNumbers = result.winningNumbers;

    try {
      const tickets = await prisma.lottoTicket.findMany({ where: { drawId: this.currentDraw.id } });

      for (const ticket of tickets) {
        const matched = ticket.numbers.filter(n => winningNumbers.includes(n)).length;
        const payout = PAYOUTS[matched] || 0n;

        if (payout > 0n) {
          await prisma.$transaction(async (tx) => {
            await tx.lottoTicket.update({
              where: { id: ticket.id },
              data: { matchedCount: matched, payout }
            });

            const wallet = await tx.wallet.findFirst({ where: { userId: ticket.userId, currency: 'INR' } });
            if (wallet) {
              const newBalance = wallet.balance + payout;
              await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

              await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  idempotencyKey: `lotto-win-${ticket.id}`,
                  type: 'BET_WIN',
                  amount: payout,
                  balanceAfter: newBalance,
                  reference: ticket.id
                }
              });
            }
          });
        } else {
          await prisma.lottoTicket.update({
            where: { id: ticket.id },
            data: { matchedCount: matched, payout: 0n }
          });
        }
      }

      console.log(`[LottoEngine:${this.room}] Settled draw ${roundId}. Tickets: ${tickets.length}`);
    } catch (err) {
      console.error(`[LottoEngine:${this.room}] Settlement error:`, err.message);
    }
  }

  async onCompleted(roundId, result) {
    if (this.currentDraw) {
      await prisma.lottoDraw.update({
        where: { id: this.currentDraw.id },
        data: { status: 'SETTLED' }
      }).catch(err => console.error(`[LottoEngine] Settle status error:`, err.message));
    }
  }

  async onNextRound() {}

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
          drawId: this.roundId,
          gameId: 'lotto',
          room: this.room,
          phase: this.currentPhase,
          status: this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN ? 'OPEN' : this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          serverSeedHash: this.serverSeedHash,
          result: this.currentResult,
          history: this.history.slice(0, 10)
        };

        this.io.to(`lotto:${this.room}`).emit('lotto:tick', tickPayload);
        this.emitEvent('round:tick', tickPayload);

      } catch (err) {
        console.error(`[LottoEngine:${this.room}] Error in loop:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { LottoEngine };
