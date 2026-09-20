const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROUND_INTERVAL_MS = 60 * 1000; // 1 min
const LOCK_DURATION_MS = 15 * 1000;  // 15 seconds locked

class BaseTableEngine {
  constructor(gameId, room, coreManager) {
    this.gameId = gameId; // 'dragon-tiger', 'baccarat', etc.
    this.room = room;     // 'VIP', 'Standard'
    this.coreManager = coreManager; // Instance of CoreSocketManager
    this.currentRound = null;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    console.log(`[TableEngine:${this.gameId}] Starting engine for room: ${this.room}`);
    await this.syncRound();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  async syncRound() {
    let round = await prisma.tableGameRound.findFirst({
      where: { gameId: this.gameId, room: this.room },
      orderBy: { startTime: 'desc' }
    });

    const now = new Date();

    if (!round || ['RESULT', 'SETTLED'].includes(round.status)) {
      round = await this.createNewRound();
    } else if (round.status === 'LOCKED' && now >= round.resultTime) {
      await this.settleRound(round);
      round = await this.createNewRound();
    } else if (round.status === 'OPEN' && now >= round.lockTime) {
      round = await this.lockRound(round);
    }

    this.currentRound = round;
  }

  async createNewRound() {
    const now = Date.now();
    const nextInterval = Math.ceil(now / ROUND_INTERVAL_MS) * ROUND_INTERVAL_MS;
    
    let startTime = new Date(nextInterval);
    if (startTime.getTime() - now < 15000) {
      startTime = new Date(nextInterval + ROUND_INTERVAL_MS);
    }

    const resultTime = new Date(startTime.getTime() + ROUND_INTERVAL_MS);
    const lockTime = new Date(resultTime.getTime() - LOCK_DURATION_MS);

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

    console.log(`[TableEngine:${this.gameId}] Created round ${round.id}. Ends at ${resultTime.toISOString()}`);
    return round;
  }

  async lockRound(round) {
    const updated = await prisma.tableGameRound.update({
      where: { id: round.id },
      data: { status: 'LOCKED' }
    });
    
    this.coreManager.emitToRoom(`tg:${this.gameId}:${this.room}`, 'tg:locked', { roundId: round.id });
    console.log(`[TableEngine:${this.gameId}] Locked round ${round.id}`);
    return updated;
  }

  // --- TO BE IMPLEMENTED BY SUBCLASSES ---
  
  /**
   * Generates the result based on serverSeed and clientSeed.
   * Returns an object containing the drawn cards and winning markets.
   */
  dealAndResolve(serverSeed, clientSeed) {
    throw new Error('dealAndResolve must be implemented by subclass');
  }

  /**
   * Given a bet market and the generated result, returns a multiplier (0 for loss).
   */
  calculatePayouts(market, result) {
    throw new Error('calculatePayouts must be implemented by subclass');
  }

  // ---------------------------------------

  async settleRound(round) {
    console.log(`[TableEngine:${this.gameId}] Settling round ${round.id}`);
    
    // 1. Deal & Resolve
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const result = this.dealAndResolve(round.serverSeed, clientSeed);

    await prisma.tableGameRound.update({
      where: { id: round.id },
      data: { status: 'RESULT', clientSeed, result }
    });

    this.coreManager.emitToRoom(`tg:${this.gameId}:${this.room}`, 'tg:result', { roundId: round.id, result });

    // 2. Evaluate Bets
    const bets = await prisma.tableGameBet.findMany({ where: { roundId: round.id } });
    
    for (const bet of bets) {
      const multiplier = this.calculatePayouts(bet.market, result);

      if (multiplier > 0) {
        // Calculate payout (amount * multiplier). Tie returning 50% = multiplier of 0.5
        const payout = BigInt(Math.floor(Number(bet.amount) * multiplier));
        
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

    // 3. SETTLED
    await prisma.tableGameRound.update({
      where: { id: round.id },
      data: { status: 'SETTLED' }
    });

    console.log(`[TableEngine:${this.gameId}] Settled ${round.id}. Bets: ${bets.length}. Winner: ${result.winner}`);
  }

  async loop() {
    while (this.isRunning) {
      const now = new Date();

      if (this.currentRound) {
        if (this.currentRound.status === 'OPEN' && now >= this.currentRound.lockTime) {
          this.currentRound = await this.lockRound(this.currentRound);
        } else if (this.currentRound.status === 'LOCKED' && now >= this.currentRound.resultTime) {
          await this.settleRound(this.currentRound);
          this.currentRound = await this.createNewRound();
        }
      }

      // Emit tick
      if (this.currentRound) {
        this.coreManager.emitToRoom(`tg:${this.gameId}:${this.room}`, 'tg:tick', {
          roundId: this.currentRound.id,
          status: this.currentRound.status,
          lockTime: this.currentRound.lockTime.getTime(),
          resultTime: this.currentRound.resultTime.getTime(),
          now: now.getTime(),
          history: [] // could send history here
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { BaseTableEngine };
