const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const provablyFair = require('./ProvablyFairService');

const ROLL_INTERVAL_MS = 60 * 1000; // 1 minute per roll
const LOCK_DURATION_MS = 10 * 1000; // 10 seconds locked before roll

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

class DiceEngine {
  constructor(room = '1min', io) {
    this.room = room;
    this.io = io;
    this.currentRoll = null;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    console.log(`[DiceEngine] Starting engine for room: ${this.room}`);
    await this.syncRoll();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  async syncRoll() {
    let roll = await prisma.diceRoll.findFirst({
      where: { room: this.room },
      orderBy: { startTime: 'desc' }
    });

    const now = new Date();

    if (!roll || ['RESULT', 'SETTLED'].includes(roll.status)) {
      roll = await this.createNewRoll();
    } else if (roll.status === 'LOCKED' && now >= roll.resultTime) {
      await this.settleRoll(roll);
      roll = await this.createNewRoll();
    } else if (roll.status === 'OPEN' && now >= roll.lockTime) {
      roll = await this.lockRoll(roll);
    }

    this.currentRoll = roll;
  }

  async createNewRoll() {
    const now = Date.now();
    const nextInterval = Math.ceil(now / ROLL_INTERVAL_MS) * ROLL_INTERVAL_MS;
    
    let startTime = new Date(nextInterval);
    if (startTime.getTime() - now < 15000) {
      startTime = new Date(nextInterval + ROLL_INTERVAL_MS);
    }

    const resultTime = new Date(startTime.getTime() + ROLL_INTERVAL_MS);
    const lockTime = new Date(resultTime.getTime() - LOCK_DURATION_MS);

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    const roll = await prisma.diceRoll.create({
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

    console.log(`[DiceEngine] Created new roll ${roll.id}. Ends at ${resultTime.toISOString()}`);
    return roll;
  }

  async lockRoll(roll) {
    const updated = await prisma.diceRoll.update({
      where: { id: roll.id },
      data: { status: 'LOCKED' }
    });
    
    this.io.to(`dice:${this.room}`).emit('dice:locked', { rollId: roll.id });
    console.log(`[DiceEngine] Locked roll ${roll.id}`);
    return updated;
  }

  generateDiceResult(serverSeed, clientSeed) {
    const result = provablyFair.deriveDiceResult(serverSeed, clientSeed, 0);
    return result.outcome;
  }

  async settleRoll(roll) {
    console.log(`[DiceEngine] Settling roll ${roll.id}`);
    
    // 1. Result Generation
    const clientSeed = crypto.randomBytes(16).toString('hex');
    const diceResult = this.generateDiceResult(roll.serverSeed, clientSeed);
    const sum = diceResult.reduce((a, b) => a + b, 0);
    const isTriple = diceResult[0] === diceResult[1] && diceResult[1] === diceResult[2];

    await prisma.diceRoll.update({
      where: { id: roll.id },
      data: { status: 'RESULT', clientSeed, diceResult }
    });

    this.io.to(`dice:${this.room}`).emit('dice:result', { rollId: roll.id, diceResult });

    // 2. Evaluate Bets
    const bets = await prisma.diceBet.findMany({ where: { rollId: roll.id } });
    
    for (const bet of bets) {
      let isWin = false;
      let multiplier = 0;

      // Evaluate logic based on market
      if (bet.market === 'SMALL') {
        isWin = (sum >= 4 && sum <= 10) && !isTriple;
        multiplier = PAYOUTS['SMALL'];
      } else if (bet.market === 'BIG') {
        isWin = (sum >= 11 && sum <= 17) && !isTriple;
        multiplier = PAYOUTS['BIG'];
      } else if (bet.market === 'ODD') {
        isWin = (sum % 2 !== 0) && !isTriple;
        multiplier = PAYOUTS['ODD'];
      } else if (bet.market === 'EVEN') {
        isWin = (sum % 2 === 0) && !isTriple;
        multiplier = PAYOUTS['EVEN'];
      } else if (bet.market === 'TRIPLE_ANY') {
        isWin = isTriple;
        multiplier = PAYOUTS['TRIPLE_ANY'];
      } else if (bet.market.startsWith('TRIPLE_')) {
        const tVal = parseInt(bet.market.split('_')[1], 10);
        isWin = isTriple && diceResult[0] === tVal;
        multiplier = PAYOUTS[bet.market];
      } else if (bet.market.startsWith('SUM_')) {
        const sVal = parseInt(bet.market.split('_')[1], 10);
        isWin = sum === sVal;
        multiplier = PAYOUTS[bet.market];
      }

      if (isWin && multiplier > 0) {
        const payout = bet.amount * BigInt(multiplier);
        
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

    // 3. SETTLED
    await prisma.diceRoll.update({
      where: { id: roll.id },
      data: { status: 'SETTLED' }
    });

    console.log(`[DiceEngine] Roll ${roll.id} settled. Tickets: ${bets.length}, Dice: [${diceResult.join(',')}]`);
  }

  async loop() {
    while (this.isRunning) {
      const now = new Date();

      if (this.currentRoll) {
        if (this.currentRoll.status === 'OPEN' && now >= this.currentRoll.lockTime) {
          this.currentRoll = await this.lockRoll(this.currentRoll);
        } else if (this.currentRoll.status === 'LOCKED' && now >= this.currentRoll.resultTime) {
          await this.settleRoll(this.currentRoll);
          this.currentRoll = await this.createNewRoll();
        }
      }

      // Emit tick
      if (this.currentRoll) {
        this.io.to(`dice:${this.room}`).emit('dice:tick', {
          rollId: this.currentRoll.id,
          status: this.currentRoll.status,
          lockTime: this.currentRoll.lockTime.getTime(),
          resultTime: this.currentRoll.resultTime.getTime(),
          now: now.getTime()
        });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { DiceEngine, PAYOUTS };
