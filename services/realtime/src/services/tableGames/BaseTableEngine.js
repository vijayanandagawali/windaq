const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PHASES = {
  BETTING_OPEN: 'BETTING_OPEN',     // 15 seconds: accept player bets
  BETTING_CLOSED: 'BETTING_CLOSED', // 2 seconds: lock betting spots, "no more bets"
  DEALING: 'DEALING',               // 4 seconds: card dealing animations from shoe
  RESULT: 'RESULT',                 // 3 seconds: reveal winning outcome & highlight zone
  SETTLEMENT: 'SETTLEMENT',         // 3 seconds: evaluate bets, credit wallets, ledger entries
  NEXT_ROUND: 'NEXT_ROUND'          // 2 seconds: clear cards, shuffle, prepare next round
};

const PHASE_DURATIONS = {
  BETTING_OPEN: 15,
  BETTING_CLOSED: 2,
  DEALING: 4,
  RESULT: 3,
  SETTLEMENT: 3,
  NEXT_ROUND: 2
};

class BaseTableEngine {
  constructor(gameId, room = 'Standard', coreManager) {
    this.gameId = gameId; // 'dragon-tiger', 'andar-bahar', etc.
    this.room = room;     // 'Standard', 'VIP'
    this.coreManager = coreManager;
    this.currentRound = null;
    this.currentPhase = PHASES.BETTING_OPEN;
    this.phaseTimeLeft = PHASE_DURATIONS.BETTING_OPEN;
    this.totalPhaseDuration = PHASE_DURATIONS.BETTING_OPEN;
    this.phaseEndsAt = Date.now() + (PHASE_DURATIONS.BETTING_OPEN * 1000);
    this.currentResult = null;
    this.clientSeed = '';
    this.dealingStep = null;
    this.recentHistory = [];
    this.isRunning = false;
    
    // Virtual Dealer Profile
    this.dealer = {
      name: 'Maya',
      title: 'Virtual Live Dealer',
      tableId: `${this.gameId}-01`,
      avatar: 'maya',
      speech: 'Welcome! Place your bets on Dragon, Tiger, or Tie.',
      action: 'INVITING_BETS'
    };
  }

  async start() {
    this.isRunning = true;
    console.log(`[TableEngine:${this.gameId}] Starting Simulated Live Table Engine for room: ${this.room}`);
    await this.loadHistory();
    await this.initRound();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  async loadHistory() {
    try {
      const pastRounds = await prisma.tableGameRound.findMany({
        where: { gameId: this.gameId, room: this.room, status: 'SETTLED' },
        orderBy: { resultTime: 'desc' },
        take: 30
      });
      this.recentHistory = pastRounds.map(r => ({
        roundId: r.id,
        result: r.result,
        resultTime: r.resultTime
      }));
    } catch (err) {
      console.error(`[TableEngine:${this.gameId}] Error loading history:`, err.message);
      this.recentHistory = [];
    }
  }

  async initRound() {
    // Check if there is an existing uncompleted round
    let round = await prisma.tableGameRound.findFirst({
      where: { gameId: this.gameId, room: this.room, status: { in: ['OPEN', 'LOCKED', 'RESULT'] } },
      orderBy: { startTime: 'desc' }
    });

    if (!round) {
      round = await this.createNewRound();
    }

    this.currentRound = round;
    this.setPhase(PHASES.BETTING_OPEN);
  }

  async createNewRound() {
    const startTime = new Date();
    const resultTime = new Date(startTime.getTime() + (Object.values(PHASE_DURATIONS).reduce((a, b) => a + b, 0) * 1000));
    const lockTime = new Date(startTime.getTime() + (PHASE_DURATIONS.BETTING_OPEN * 1000));

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    const round = await prisma.tableGameRound.create({
      data: {
        gameId: this.gameId,
        room: this.room,
        status: 'OPEN',
        serverSeed,
        serverSeedHash,
        clientSeed: '',
        startTime,
        lockTime,
        resultTime
      }
    });

    console.log(`[TableEngine:${this.gameId}] Created new round ${round.id}. SeedHash: ${serverSeedHash.substring(0, 10)}...`);
    return round;
  }

  setPhase(phase) {
    this.currentPhase = phase;
    const duration = PHASE_DURATIONS[phase] || 5;
    this.totalPhaseDuration = duration;
    this.phaseTimeLeft = duration;
    this.phaseEndsAt = Date.now() + (duration * 1000);

    // Update dealer speech & actions based on phase
    this.updateDealerState(phase);

    // Emit phase change to room
    this.emitEvent('tg:phase_change', {
      roundId: this.currentRound?.id,
      phase: this.currentPhase,
      duration: this.totalPhaseDuration,
      phaseEndsAt: this.phaseEndsAt,
      dealer: this.dealer,
      result: this.currentResult,
      dealingStep: this.dealingStep
    });
  }

  updateDealerState(phase) {
    switch (phase) {
      case PHASES.BETTING_OPEN:
        this.dealer.action = 'INVITING_BETS';
        this.dealer.speech = this.getDealerSpeech('BETTING_OPEN', null);
        break;
      case PHASES.BETTING_CLOSED:
        this.dealer.action = 'CLOSING_BETS';
        this.dealer.speech = this.getDealerSpeech('BETTING_CLOSED', null);
        break;
      case PHASES.DEALING:
        this.dealer.action = 'DEALING';
        this.dealer.speech = this.getDealerSpeech('DEALING', this.currentResult);
        break;
      case PHASES.RESULT:
        this.dealer.action = 'ANNOUNCING_RESULT';
        this.dealer.speech = this.getDealerSpeech('RESULT', this.currentResult);
        break;
      case PHASES.SETTLEMENT:
        this.dealer.action = 'SETTLING';
        this.dealer.speech = this.getDealerSpeech('SETTLEMENT', this.currentResult);
        break;
      case PHASES.NEXT_ROUND:
        this.dealer.action = 'PREPARING_NEXT';
        this.dealer.speech = this.getDealerSpeech('NEXT_ROUND', null);
        break;
    }
  }

  // --- SUBCLASS HOOKS ---
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
      case PHASES.BETTING_OPEN:
        return 'Place your bets please! 15 seconds remaining.';
      case PHASES.BETTING_CLOSED:
        return 'Bets are closed. No more bets, thank you!';
      case PHASES.DEALING:
        return 'Dealing the cards from the shoe...';
      case PHASES.RESULT:
        return result?.winner ? `${result.winner} WINS!` : 'Round completed.';
      case PHASES.SETTLEMENT:
        return 'Settling winning bets. Congratulations to all winners!';
      case PHASES.NEXT_ROUND:
        return 'Preparing the table for the next round...';
      default:
        return 'Welcome to the Simulated Live Table.';
    }
  }

  // --- ACTIONS PER PHASE ---
  async handlePhaseTransition() {
    switch (this.currentPhase) {
      case PHASES.BETTING_OPEN:
        // Transition: BETTING_OPEN -> BETTING_CLOSED
        if (this.currentRound) {
          await prisma.tableGameRound.update({
            where: { id: this.currentRound.id },
            data: { status: 'LOCKED' }
          }).catch(err => console.error(`[TableEngine] Lock round error:`, err.message));
        }
        this.emitEvent('tg:locked', { roundId: this.currentRound?.id });
        this.setPhase(PHASES.BETTING_CLOSED);
        break;

      case PHASES.BETTING_CLOSED:
        // Transition: BETTING_CLOSED -> DEALING
        if (this.currentRound) {
          // Generate outcome deterministically
          this.clientSeed = crypto.randomBytes(16).toString('hex');
          this.currentResult = this.dealAndResolve(this.currentRound.serverSeed, this.clientSeed);
          
          await prisma.tableGameRound.update({
            where: { id: this.currentRound.id },
            data: { 
              status: 'DEALING',
              clientSeed: this.clientSeed,
              result: this.currentResult
            }
          }).catch(err => console.error(`[TableEngine] Dealing update error:`, err.message));
        }
        this.dealingStep = { step: 1, totalSteps: 2, name: 'Dragon' };
        this.setPhase(PHASES.DEALING);
        break;

      case PHASES.DEALING:
        // Transition: DEALING -> RESULT
        if (this.currentRound) {
          await prisma.tableGameRound.update({
            where: { id: this.currentRound.id },
            data: { status: 'RESULT' }
          }).catch(err => console.error(`[TableEngine] Result status error:`, err.message));
        }
        
        // Push to recent history
        if (this.currentResult) {
          this.recentHistory.unshift({
            roundId: this.currentRound?.id,
            result: this.currentResult,
            resultTime: new Date()
          });
          if (this.recentHistory.length > 30) this.recentHistory.pop();
        }

        this.emitEvent('tg:result', {
          roundId: this.currentRound?.id,
          result: this.currentResult,
          winner: this.currentResult?.winner,
          dealer: this.dealer
        });

        this.setPhase(PHASES.RESULT);
        break;

      case PHASES.RESULT:
        // Transition: RESULT -> SETTLEMENT
        await this.settleBets();
        this.setPhase(PHASES.SETTLEMENT);
        break;

      case PHASES.SETTLEMENT:
        // Transition: SETTLEMENT -> NEXT_ROUND
        if (this.currentRound) {
          await prisma.tableGameRound.update({
            where: { id: this.currentRound.id },
            data: { status: 'SETTLED' }
          }).catch(err => console.error(`[TableEngine] Settled status error:`, err.message));
        }
        this.setPhase(PHASES.NEXT_ROUND);
        break;

      case PHASES.NEXT_ROUND:
        // Transition: NEXT_ROUND -> BETTING_OPEN
        this.currentResult = null;
        this.clientSeed = '';
        this.dealingStep = null;
        this.currentRound = await this.createNewRound();
        this.setPhase(PHASES.BETTING_OPEN);
        break;
    }
  }

  async settleBets() {
    if (!this.currentRound || !this.currentResult) return;

    try {
      const bets = await prisma.tableGameBet.findMany({ where: { roundId: this.currentRound.id } });
      let totalPayout = 0n;
      let winnersCount = 0;

      for (const bet of bets) {
        const multiplier = this.calculatePayouts(bet.market, this.currentResult);

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
        roundId: this.currentRound.id,
        betsCount: bets.length,
        winnersCount,
        totalPayout: totalPayout.toString()
      });

      console.log(`[TableEngine:${this.gameId}] Settled round ${this.currentRound.id}. Bets: ${bets.length}, Winners: ${winnersCount}, Payout: ₹${Number(totalPayout)/100}`);
    } catch (err) {
      console.error(`[TableEngine:${this.gameId}] Settle error:`, err.message);
    }
  }

  emitEvent(eventName, payload) {
    if (this.coreManager) {
      this.coreManager.emitToRoom(`tg:${this.gameId}:${this.room}`, eventName, payload);
    }
  }

  async loop() {
    while (this.isRunning) {
      try {
        this.phaseTimeLeft -= 1;

        // During DEALING phase, advance card dealing steps smoothly
        if (this.currentPhase === PHASES.DEALING) {
          if (this.phaseTimeLeft === 2) {
            this.dealingStep = { step: 2, totalSteps: 2, name: 'Tiger' };
            this.emitEvent('tg:dealing_step', { step: 2, target: 'TIGER', card: this.currentResult?.tiger });
          } else if (this.phaseTimeLeft === 3) {
            this.dealingStep = { step: 1, totalSteps: 2, name: 'Dragon' };
            this.emitEvent('tg:dealing_step', { step: 1, target: 'DRAGON', card: this.currentResult?.dragon });
          }
        }

        if (this.phaseTimeLeft <= 0) {
          await this.handlePhaseTransition();
        }

        // Emit 1-second state tick
        this.emitEvent('tg:tick', {
          roundId: this.currentRound?.id,
          gameId: this.gameId,
          room: this.room,
          phase: this.currentPhase,
          phaseTimeLeft: Math.max(0, this.phaseTimeLeft),
          totalPhaseDuration: this.totalPhaseDuration,
          phaseEndsAt: this.phaseEndsAt,
          dealer: this.dealer,
          result: (this.currentPhase === PHASES.RESULT || this.currentPhase === PHASES.SETTLEMENT || this.currentPhase === PHASES.NEXT_ROUND) ? this.currentResult : null,
          dealingStep: this.dealingStep,
          serverSeedHash: this.currentRound?.serverSeedHash,
          serverSeed: (this.currentPhase === PHASES.RESULT || this.currentPhase === PHASES.SETTLEMENT || this.currentPhase === PHASES.NEXT_ROUND) ? this.currentRound?.serverSeed : null,
          clientSeed: (this.currentPhase === PHASES.RESULT || this.currentPhase === PHASES.SETTLEMENT || this.currentPhase === PHASES.NEXT_ROUND) ? this.clientSeed : null,
          history: this.recentHistory.slice(0, 20),
          now: Date.now()
        });

      } catch (loopErr) {
        console.error(`[TableEngine:${this.gameId}] Loop error:`, loopErr.message);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { BaseTableEngine, PHASES, PHASE_DURATIONS };
