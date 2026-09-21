const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('./engine/UniversalRoundEngine');

class ColourEngine extends UniversalRoundEngine {
  constructor(io, roomName = '1min', durationMs = 60000) {
    const totalSeconds = Math.floor(durationMs / 1000);
    const bettingOpenSeconds = Math.max(10, totalSeconds - 15);

    const customDurations = {
      CREATED: 1,
      BETTING_OPEN: bettingOpenSeconds,
      BETTING_CLOSED: 5,
      PLAYING: 3,
      RESULT: 3,
      SETTLEMENT: 2,
      COMPLETED: 1,
      NEXT_ROUND: 1
    };

    super('colour', roomName, io, customDurations);
    this.roomName = roomName;
    this.io = io;
    this.durationMs = durationMs;
    this.period = BigInt(parseInt(new Date().toISOString().replace(/\D/g, '').substring(0, 12)) + "001");
    this.dbRound = null;
  }

  async startLoop() {
    await this.start();
  }

  // --- UNIVERSAL ENGINE HOOKS ---

  async onCreateRound(roundId) {
    this.period++;
    this.nonce++;

    try {
      this.dbRound = await prisma.colourRound.upsert({
        where: { room_period: { room: this.roomName, period: this.period } },
        update: {
          state: UNIVERSAL_PHASES.CREATED,
          serverSeed: this.serverSeed,
          clientSeed: this.clientSeed,
          nonce: this.nonce
        },
        create: {
          id: roundId,
          room: this.roomName,
          period: this.period,
          state: UNIVERSAL_PHASES.CREATED,
          serverSeed: this.serverSeed,
          clientSeed: this.clientSeed,
          nonce: this.nonce
        }
      });
      console.log(`[ColourEngine:${this.roomName}] Created round ${this.period} (${roundId})`);
    } catch (err) {
      console.error(`[ColourEngine:${this.roomName}] DB create error:`, err.message);
    }
  }

  async onBettingOpen(roundId) {
    if (this.dbRound) {
      await prisma.colourRound.update({
        where: { id: this.dbRound.id },
        data: { state: UNIVERSAL_PHASES.BETTING_OPEN }
      }).catch(err => console.error(`[ColourEngine] Open error:`, err.message));
    }
  }

  async onBettingClosed(roundId) {
    if (this.dbRound) {
      await prisma.colourRound.update({
        where: { id: this.dbRound.id },
        data: { state: 'LOCKED' }
      }).catch(err => console.error(`[ColourEngine] Lock error:`, err.message));
    }
    this.io.to(`colour:${this.roomName}`).emit('colour:state', { state: 'LOCKED' });
  }

  async onBettingLocked(roundId) {
    return this.onBettingClosed(roundId);
  }

  async onPlay(roundId) {
    this.io.to(`colour:${this.roomName}`).emit('colour:state', { state: 'PLAYING' });
  }

  async onResult(roundId) {
    // Provably fair derivation
    const hmac = crypto.createHmac('sha256', this.serverSeed).update(`${this.clientSeed}:${this.nonce}`).digest('hex');
    const winningNumber = parseInt(hmac.substring(0, 2), 16) % 10;
    
    let winningColor = 'green';
    if (winningNumber === 0 || winningNumber === 5) winningColor = 'violet';
    else if (winningNumber % 2 === 0) winningColor = 'red';
    
    const winningSize = winningNumber >= 5 ? 'big' : 'small';

    const result = {
      number: winningNumber,
      color: winningColor,
      size: winningSize
    };

    if (this.dbRound) {
      await prisma.colourRound.update({
        where: { id: this.dbRound.id },
        data: {
          state: 'RESULT',
          resultNum: winningNumber,
          resultColor: winningColor,
          resultSize: winningSize
        }
      }).catch(err => console.error(`[ColourEngine] Result save error:`, err.message));
    }

    this.io.to(`colour:${this.roomName}`).emit('colour:result', {
      period: this.period.toString(),
      resultNum: winningNumber,
      resultColor: winningColor,
      resultSize: winningSize,
      serverSeed: this.serverSeed
    });

    return result;
  }

  async onSettlement(roundId, result) {
    if (!this.dbRound || !result) return;

    try {
      const bets = await prisma.colourBet.findMany({
        where: { roundId: this.dbRound.id, status: 'PENDING' }
      });

      for (const bet of bets) {
        let isWin = false;

        if (bet.betType === 'color' && bet.betValue === result.color) isWin = true;
        else if (bet.betType === 'number' && parseInt(bet.betValue) === result.number) isWin = true;
        else if (bet.betType === 'size' && bet.betValue === result.size) isWin = true;

        if (isWin) {
          const payout = BigInt(Math.floor(Number(bet.amount) * (bet.multiplier || 2)));
          await prisma.$transaction(async (tx) => {
            await tx.colourBet.update({
              where: { id: bet.id },
              data: { status: 'WON', payout }
            });

            const wallet = await tx.wallet.findFirst({ where: { userId: bet.userId, currency: 'INR' } });
            if (wallet) {
              const newBalance = wallet.balance + payout;
              await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

              await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  idempotencyKey: `colour-win-${bet.id}`,
                  type: 'BET_WIN',
                  amount: payout,
                  balanceAfter: newBalance,
                  reference: bet.id
                }
              });
            }
          });
        } else {
          await prisma.colourBet.update({
            where: { id: bet.id },
            data: { status: 'LOST', payout: 0n }
          });
        }
      }

      console.log(`[ColourEngine:${this.roomName}] Settled round ${this.period}. Bets: ${bets.length}`);
    } catch (err) {
      console.error(`[ColourEngine:${this.roomName}] Settle error:`, err.message);
    }
  }

  async onCompleted(roundId, result) {
    if (this.dbRound) {
      await prisma.colourRound.update({
        where: { id: this.dbRound.id },
        data: { state: 'SETTLED', settledAt: new Date() }
      }).catch(err => console.error(`[ColourEngine] Settle status error:`, err.message));
    }
  }

  async onNextRound() {}

  /**
   * Overwrite loop to emit colour:tick alongside round:tick
   */
  async loop() {
    while (this.isRunning) {
      try {
        const now = Date.now();
        this.phaseTimeLeft = Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));

        if (now >= this.phaseEndsAt) {
          await this.handlePhaseTransition();
        }

        // Authoritative Tick Broadcast
        const tickPayload = {
          roundId: this.roundId,
          gameId: 'colour',
          room: this.roomName,
          period: this.period.toString(),
          phase: this.currentPhase,
          state: this.currentPhase === UNIVERSAL_PHASES.BETTING_OPEN ? 'BETTING_OPEN' : this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          remainingSeconds: this.phaseTimeLeft,
          hash: this.serverSeedHash,
          serverSeed: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                       this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                       this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                       this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.serverSeed : null,
          result: this.currentResult,
          history: this.history.slice(0, 20)
        };

        this.io.to(`colour:${this.roomName}`).emit('colour:tick', tickPayload);
        this.emitEvent('round:tick', tickPayload);

      } catch (err) {
        console.error(`[ColourEngine:${this.roomName}] Error in loop:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = ColourEngine;
