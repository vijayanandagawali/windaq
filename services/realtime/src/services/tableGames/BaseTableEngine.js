const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { UniversalRoundEngine, UNIVERSAL_PHASES } = require('../engine/UniversalRoundEngine');

class BaseTableEngine extends UniversalRoundEngine {
  constructor(gameId, room = 'Standard', coreManager, customDurations = {}) {
    // Custom table game durations
    const durations = {
      CREATED: 1,
      BETTING_OPEN: 15,
      BETTING_CLOSED: 2,
      PLAYING: 4,       // Dealing card animations
      RESULT: 3,        // Winner reveal
      SETTLEMENT: 3,    // Wallet payouts
      COMPLETED: 1,     // Finalize DB
      NEXT_ROUND: 2,    // Table reset
      ...customDurations
    };

    super(gameId, room, coreManager, durations);

    // Database record reference
    this.dbRound = null;
    this.dealingStep = null;

    // Virtual Live Dealer Profile
    this.dealer = {
      name: 'Maya',
      title: 'Virtual Live Dealer',
      tableId: `${this.gameId}-01`,
      avatar: 'maya',
      speech: 'Welcome! Place your bets on Dragon, Tiger, or Tie.',
      action: 'INVITING_BETS'
    };
  }

  /**
   * Subclass Hooks for specific games
   */
  dealAndResolve(serverSeed, clientSeed) {
    throw new Error('dealAndResolve must be implemented by subclass');
  }

  calculatePayouts(market, result) {
    throw new Error('calculatePayouts must be implemented by subclass');
  }

  getDealingSteps(result) {
    return [];
  }

  getDealerSpeech(phase, result) {
    switch (phase) {
      case UNIVERSAL_PHASES.BETTING_OPEN:
        return 'Place your bets please! 15 seconds remaining.';
      case UNIVERSAL_PHASES.BETTING_CLOSED:
        return 'Bets are closed. No more bets, thank you!';
      case UNIVERSAL_PHASES.PLAYING:
        return 'Dealing the cards from the shoe...';
      case UNIVERSAL_PHASES.RESULT:
        return result?.winner ? `${result.winner} WINS!` : 'Round completed.';
      case UNIVERSAL_PHASES.SETTLEMENT:
        return 'Settling winning bets. Congratulations to all winners!';
      case UNIVERSAL_PHASES.COMPLETED:
        return 'Round complete.';
      case UNIVERSAL_PHASES.NEXT_ROUND:
        return 'Preparing the table for the next round...';
      default:
        return 'Welcome to the Simulated Live Table.';
    }
  }

  updateDealerState(phase) {
    switch (phase) {
      case UNIVERSAL_PHASES.BETTING_OPEN:
        this.dealer.action = 'INVITING_BETS';
        this.dealer.speech = this.getDealerSpeech(UNIVERSAL_PHASES.BETTING_OPEN, null);
        break;
      case UNIVERSAL_PHASES.BETTING_CLOSED:
        this.dealer.action = 'CLOSING_BETS';
        this.dealer.speech = this.getDealerSpeech(UNIVERSAL_PHASES.BETTING_CLOSED, null);
        break;
      case UNIVERSAL_PHASES.PLAYING:
        this.dealer.action = 'DEALING';
        this.dealer.speech = this.getDealerSpeech(UNIVERSAL_PHASES.PLAYING, this.currentResult);
        break;
      case UNIVERSAL_PHASES.RESULT:
        this.dealer.action = 'ANNOUNCING_RESULT';
        this.dealer.speech = this.getDealerSpeech(UNIVERSAL_PHASES.RESULT, this.currentResult);
        break;
      case UNIVERSAL_PHASES.SETTLEMENT:
        this.dealer.action = 'SETTLING';
        this.dealer.speech = this.getDealerSpeech(UNIVERSAL_PHASES.SETTLEMENT, this.currentResult);
        break;
      case UNIVERSAL_PHASES.NEXT_ROUND:
        this.dealer.action = 'PREPARING_NEXT';
        this.dealer.speech = this.getDealerSpeech(UNIVERSAL_PHASES.NEXT_ROUND, null);
        break;
    }
  }

  // --- UNIVERSAL ENGINE HOOKS ---

  async onCreateRound(roundId) {
    try {
      const startTime = new Date();
      const totalSeconds = Object.values(this.phaseDurations).reduce((a, b) => a + b, 0);
      const resultTime = new Date(startTime.getTime() + (totalSeconds * 1000));
      const lockTime = new Date(startTime.getTime() + (this.phaseDurations.BETTING_OPEN * 1000));

      this.dbRound = await prisma.tableGameRound.create({
        data: {
          id: roundId,
          gameId: this.gameId,
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
      console.log(`[BaseTableEngine:${this.gameId}] Created DB round ${roundId}`);
    } catch (err) {
      console.error(`[BaseTableEngine:${this.gameId}] DB round create error:`, err.message);
    }
  }

  async onBettingOpen(roundId) {
    this.updateDealerState(UNIVERSAL_PHASES.BETTING_OPEN);
  }

  async onBettingClosed(roundId) {
    this.updateDealerState(UNIVERSAL_PHASES.BETTING_CLOSED);
    if (this.dbRound) {
      await prisma.tableGameRound.update({
        where: { id: this.dbRound.id },
        data: { status: 'LOCKED' }
      }).catch(err => console.error(`[BaseTableEngine] Lock round error:`, err.message));
    }
    this.emitEvent('tg:locked', { roundId });
  }

  async onPlay(roundId) {
    this.updateDealerState(UNIVERSAL_PHASES.PLAYING);
    this.dealingStep = { step: 1, totalSteps: 2, name: 'Dragon' };
  }

  async onResult(roundId) {
    const result = this.dealAndResolve(this.serverSeed, this.clientSeed);
    this.updateDealerState(UNIVERSAL_PHASES.RESULT);

    if (this.dbRound) {
      await prisma.tableGameRound.update({
        where: { id: this.dbRound.id },
        data: {
          status: 'RESULT',
          clientSeed: this.clientSeed,
          result
        }
      }).catch(err => console.error(`[BaseTableEngine] Result save error:`, err.message));
    }

    this.emitEvent('tg:result', {
      roundId,
      result,
      winner: result?.winner,
      dealer: this.dealer
    });

    return result;
  }

  async onSettlement(roundId, result) {
    this.updateDealerState(UNIVERSAL_PHASES.SETTLEMENT);
    if (!this.dbRound || !result) return;

    try {
      const bets = await prisma.tableGameBet.findMany({ where: { roundId: this.dbRound.id } });
      let totalPayout = 0n;
      let winnersCount = 0;

      for (const bet of bets) {
        const multiplier = this.calculatePayouts(bet.market, result);

        if (multiplier > 0) {
          const payout = BigInt(Math.floor(Number(bet.amount) * multiplier));
          totalPayout += payout;
          winnersCount++;

          await prisma.$transaction(async (tx) => {
            await tx.tableGameBet.update({
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
                  idempotencyKey: `tg-win-${bet.id}`,
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

      this.emitEvent('tg:settled', {
        roundId,
        betsCount: bets.length,
        winnersCount,
        totalPayout: totalPayout.toString()
      });

      console.log(`[BaseTableEngine:${this.gameId}] Settled round ${roundId}. Bets: ${bets.length}, Winners: ${winnersCount}`);
    } catch (err) {
      console.error(`[BaseTableEngine:${this.gameId}] Settlement error:`, err.message);
    }
  }

  async onCompleted(roundId, result) {
    if (this.dbRound) {
      await prisma.tableGameRound.update({
        where: { id: this.dbRound.id },
        data: { status: 'SETTLED' }
      }).catch(err => console.error(`[BaseTableEngine] Settled status error:`, err.message));
    }
  }

  async onNextRound() {
    this.updateDealerState(UNIVERSAL_PHASES.NEXT_ROUND);
    this.dealingStep = null;
  }

  /**
   * Overwrite loop to emit game-specific tg:tick alongside round:tick
   */
  async loop() {
    while (this.isRunning) {
      try {
        const now = Date.now();
        this.phaseTimeLeft = Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));

        // During PLAYING phase, advance dealing step animations
        if (this.currentPhase === UNIVERSAL_PHASES.PLAYING) {
          if (this.phaseTimeLeft === 2) {
            this.dealingStep = { step: 2, totalSteps: 2, name: 'Tiger' };
            this.emitEvent('tg:dealing_step', { step: 2, target: 'TIGER' });
          } else if (this.phaseTimeLeft === 3) {
            this.dealingStep = { step: 1, totalSteps: 2, name: 'Dragon' };
            this.emitEvent('tg:dealing_step', { step: 1, target: 'DRAGON' });
          }
        }

        if (now >= this.phaseEndsAt) {
          await this.handlePhaseTransition();
        }

        // Authoritative Tick Broadcast (Universal + Legacy Table compatibility)
        const tickPayload = {
          roundId: this.roundId,
          gameId: this.gameId,
          room: this.room,
          phase: this.currentPhase,
          serverTime: now,
          phaseEndsAt: this.phaseEndsAt,
          phaseTimeLeft: this.phaseTimeLeft,
          totalPhaseDuration: this.totalPhaseDuration,
          dealer: this.dealer,
          dealingStep: this.dealingStep,
          serverSeedHash: this.serverSeedHash,
          serverSeed: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                       this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                       this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                       this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.serverSeed : null,
          clientSeed: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                       this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                       this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                       this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.clientSeed : null,
          result: (this.currentPhase === UNIVERSAL_PHASES.RESULT || 
                   this.currentPhase === UNIVERSAL_PHASES.SETTLEMENT || 
                   this.currentPhase === UNIVERSAL_PHASES.COMPLETED ||
                   this.currentPhase === UNIVERSAL_PHASES.NEXT_ROUND) ? this.currentResult : null,
          history: this.history.slice(0, 20)
        };

        this.emitEvent('round:tick', tickPayload);
        this.emitEvent('tg:tick', tickPayload);

      } catch (err) {
        console.error(`[BaseTableEngine:${this.gameId}] Error in loop:`, err.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { BaseTableEngine, UNIVERSAL_PHASES };
