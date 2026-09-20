const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const provablyFair = require('../ProvablyFairService');

const ROUND_INTERVAL_MS = 60 * 1000; // 1 min
const LOCK_DURATION_MS = 15 * 1000;  // 15 seconds locked

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

class RouletteEngine {
  constructor(room, coreManager) {
    this.room = room;
    this.coreManager = coreManager;
    this.currentRound = null;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    console.log(`[RouletteEngine] Starting engine for room: ${this.room}`);
    await this.syncRound();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  async syncRound() {
    let round = await prisma.rouletteRoll.findFirst({
      where: { room: this.room },
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

    const round = await prisma.rouletteRoll.create({
      data: {
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

    console.log(`[RouletteEngine] Created round ${round.id}. Ends at ${resultTime.toISOString()}`);
    return round;
  }

  async lockRound(round) {
    const updated = await prisma.rouletteRoll.update({
      where: { id: round.id },
      data: { status: 'LOCKED' }
    });
    
    this.coreManager.emitToRoom(`roulette:${this.room}`, 'roulette:locked', { roundId: round.id });
    console.log(`[RouletteEngine] Locked round ${round.id}`);
    return updated;
  }

  generateResult(serverSeed, clientSeed) {
    const result = provablyFair.deriveRouletteResult(serverSeed, clientSeed, 0);
    return result.outcome;
  }

  evaluateBet(bet, resultNumber) {
    const targets = bet.targets; 
    if (Array.isArray(targets) && targets.includes(resultNumber)) {
       const multiplier = PAYOUTS[bet.marketType] || 0;
       return multiplier + 1; // +1 includes original stake return
    }
    return 0;
  }

  async settleRound(round) {
    console.log(`[RouletteEngine] Settling round ${round.id}`);
    
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const resultNumber = this.generateResult(round.serverSeed, clientSeed);

    await prisma.rouletteRoll.update({
      where: { id: round.id },
      data: { status: 'RESULT', clientSeed, resultNumber }
    });

    this.coreManager.emitToRoom(`roulette:${this.room}`, 'roulette:result', { roundId: round.id, resultNumber });

    const bets = await prisma.rouletteBet.findMany({ where: { rollId: round.id } });
    
    for (const bet of bets) {
      const payoutMultiplier = this.evaluateBet(bet, resultNumber);

      if (payoutMultiplier > 0) {
        const payout = BigInt(Math.floor(Number(bet.amount) * payoutMultiplier));
        
        await prisma.$transaction(async (tx) => {
          await tx.rouletteBet.update({
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
                idempotencyKey: `roulette-win-${bet.id}`,
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

    await prisma.rouletteRoll.update({
      where: { id: round.id },
      data: { status: 'SETTLED' }
    });

    console.log(`[RouletteEngine] Settled ${round.id}. Bets: ${bets.length}. Winner: ${resultNumber}`);
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

      if (this.currentRound) {
        this.coreManager.emitToRoom(`roulette:${this.room}`, 'roulette:tick', {
          roundId: this.currentRound.id,
          status: this.currentRound.status,
          lockTime: this.currentRound.lockTime.getTime(),
          resultTime: this.currentRound.resultTime.getTime(),
          now: now.getTime()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { RouletteEngine };
