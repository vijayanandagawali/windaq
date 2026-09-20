const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STATE = {
  UPCOMING: 'UPCOMING',
  BETTING_OPEN: 'BETTING_OPEN',
  LOCKED: 'LOCKED',
  RESULT: 'RESULT',
  SETTLED: 'SETTLED'
};

class ColourEngine {
  constructor(io, roomName, durationMs) {
    this.io = io;
    this.roomName = roomName; // '1min', '3min', '5min', '10min'
    this.durationMs = durationMs;
    
    // Timing config
    this.lockDurationMs = 10000; // Last 10 seconds is locked
    this.resultDurationMs = 3000; // Show result for 3 seconds before next round
    
    this.state = STATE.UPCOMING;
    this.period = BigInt(parseInt(new Date().toISOString().replace(/\D/g, '').substring(0, 12)) + "001");
    this.serverSeed = "";
    this.clientSeed = "0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c";
    this.nonce = 1;
    this.roundId = null;
    this.remainingMs = 0;
  }

  async startLoop() {
    console.log(`Starting Colour Engine for room: ${this.roomName} (${this.durationMs/1000}s)`);
    this.scheduleNextRound();
  }

  async scheduleNextRound() {
    this.state = STATE.UPCOMING;
    this.period++;
    this.nonce++;
    this.serverSeed = crypto.randomBytes(32).toString('hex');
    this.hash = crypto.createHmac('sha256', this.serverSeed).update(this.nonce.toString()).digest('hex');
    
    // Create DB Round
      // Create or Resume DB Round
      const round = await prisma.colourRound.upsert({
        where: { room_period: { room: this.roomName, period: this.period } },
        update: {
          state: this.state
        },
        create: {
          room: this.roomName,
          period: this.period,
          state: this.state,
          serverSeed: this.serverSeed,
          clientSeed: this.clientSeed,
          nonce: this.nonce
        }
      });
      // If we recovered an existing round, use its ID
      this.currentRoundId = round.id;
      this.roundId = round.id;
    
    this.startBetting();
  }

  async startBetting() {
    this.state = STATE.BETTING_OPEN;
    await prisma.colourRound.update({ where: { id: this.roundId }, data: { state: this.state } });
    
    const bettingDurationMs = this.durationMs - this.lockDurationMs - this.resultDurationMs;
    this.remainingMs = bettingDurationMs + this.lockDurationMs;
    
    // Tick loop
    this.tickInterval = setInterval(() => {
      this.remainingMs -= 1000;
      this.io.to(`colour:${this.roomName}`).emit('colour:tick', {
        period: this.period.toString(),
        state: this.state,
        remainingSeconds: Math.floor(this.remainingMs / 1000),
        hash: this.hash
      });
      
      if (this.remainingMs <= this.lockDurationMs && this.state === STATE.BETTING_OPEN) {
        this.lockBetting();
      }
      
      if (this.remainingMs <= 0) {
        clearInterval(this.tickInterval);
        this.generateResult();
      }
    }, 1000);
  }

  async lockBetting() {
    this.state = STATE.LOCKED;
    await prisma.colourRound.update({ where: { id: this.roundId }, data: { state: this.state } });
    this.io.to(`colour:${this.roomName}`).emit('colour:state', { state: this.state });
  }

  async generateResult() {
    this.state = STATE.RESULT;
    
    // Provably fair generation
    const hmac = crypto.createHmac('sha256', this.serverSeed).update(`${this.clientSeed}:${this.nonce}`).digest('hex');
    // Simple mock logic using first byte for number 0-9
    const winningNumber = parseInt(hmac.substring(0, 2), 16) % 10;
    
    let winningColor = 'green';
    if (winningNumber === 0 || winningNumber === 5) winningColor = 'violet';
    else if (winningNumber % 2 === 0) winningColor = 'red';
    
    let winningSize = winningNumber >= 5 ? 'big' : 'small';
    
    await prisma.colourRound.update({ 
      where: { id: this.roundId }, 
      data: { 
        state: this.state,
        resultNum: winningNumber,
        resultColor: winningColor,
        resultSize: winningSize
      } 
    });

    this.io.to(`colour:${this.roomName}`).emit('colour:result', {
      period: this.period.toString(),
      number: winningNumber,
      color: winningColor,
      size: winningSize,
      serverSeed: this.serverSeed
    });
    
    this.settleBets(winningNumber, winningColor, winningSize);
  }

  async settleBets(num, color, size) {
    this.state = STATE.SETTLED;
    
    try {
      await prisma.$transaction(async (tx) => {
        // Update round
        await tx.colourRound.update({ where: { id: this.roundId }, data: { state: this.state, settledAt: new Date() } });
        
        // Find all pending bets for this round
        const bets = await tx.colourBet.findMany({ where: { roundId: this.roundId, status: 'PENDING' } });
        
        for (const bet of bets) {
          let won = false;
          if (bet.betType === 'number' && parseInt(bet.betValue) === num) won = true;
          if (bet.betType === 'color' && bet.betValue === color) won = true;
          if (bet.betType === 'size' && bet.betValue === size) won = true;

          if (won) {
            const payoutAmount = BigInt(bet.amount) * BigInt(Math.floor(bet.multiplier * 100)) / 100n;
            
            await tx.colourBet.update({
              where: { id: bet.id },
              data: { status: 'WON', payout: payoutAmount }
            });

            // Credit Wallet (assuming currency INR)
            const wallet = await tx.wallet.findFirst({ where: { userId: bet.userId, currency: 'INR' } });
            if (wallet) {
              const newBalance = BigInt(wallet.balance) + payoutAmount;
              await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
              
              await tx.transaction.create({
                data: {
                  walletId: wallet.id,
                  idempotencyKey: `win-${bet.id}`,
                  type: 'BET_WIN',
                  amount: payoutAmount,
                  balanceAfter: newBalance,
                  reference: bet.id
                }
              });
            }
          } else {
            await tx.colourBet.update({
              where: { id: bet.id },
              data: { status: 'LOST', payout: 0n }
            });
          }
        }
      });
      console.log(`[ColourEngine] Round ${this.period} settled successfully.`);
    } catch (e) {
      console.error(`[ColourEngine] Failed to settle round ${this.period}:`, e);
    }
    
    setTimeout(() => {
      this.scheduleNextRound();
    }, this.resultDurationMs);
  }
}

module.exports = ColourEngine;
