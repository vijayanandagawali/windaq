const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRAW_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_DURATION_MS = 30 * 1000;     // 30 seconds before draw

// Payout structure for ₹100 stake (10000 paise)
const TICKET_PRICE = 10000n; // 100 INR in paise
const PAYOUTS = {
  3: 50000n,        // 500 INR
  4: 500000n,       // 5,000 INR
  5: 5000000n,      // 50,000 INR
  6: 1000000000n    // 10,000,000 INR (Jackpot)
};

class LottoEngine {
  constructor(room = '5min', io) {
    this.room = room;
    this.io = io;
    this.currentDraw = null;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    console.log(`[LottoEngine] Starting engine for room: ${this.room}`);
    await this.syncDraw();
    this.loop();
  }

  stop() {
    this.isRunning = false;
  }

  async syncDraw() {
    // Find the latest draw
    let draw = await prisma.lottoDraw.findFirst({
      where: { room: this.room },
      orderBy: { startTime: 'desc' }
    });

    const now = new Date();

    if (!draw || ['RESULT', 'SETTLED'].includes(draw.status)) {
      draw = await this.createNewDraw();
    } else if (draw.status === 'LOCKED' && now >= draw.resultTime) {
      await this.settleDraw(draw);
      draw = await this.createNewDraw();
    } else if (draw.status === 'OPEN' && now >= draw.lockTime) {
      draw = await this.lockDraw(draw);
    }

    this.currentDraw = draw;
  }

  async createNewDraw() {
    const now = Date.now();
    
    // Align to nearest 5 min
    const nextInterval = Math.ceil(now / DRAW_INTERVAL_MS) * DRAW_INTERVAL_MS;
    
    let startTime = new Date(nextInterval);
    // If it's too close (e.g. less than 1 min), jump to the next one
    if (startTime.getTime() - now < 60000) {
      startTime = new Date(nextInterval + DRAW_INTERVAL_MS);
    }

    const resultTime = new Date(startTime.getTime() + DRAW_INTERVAL_MS);
    const lockTime = new Date(resultTime.getTime() - LOCK_DURATION_MS);

    const serverSeed = crypto.randomBytes(32).toString('hex');
    const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

    const draw = await prisma.lottoDraw.create({
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

    console.log(`[LottoEngine] Created new draw ${draw.id}. Ends at ${resultTime.toISOString()}`);
    return draw;
  }

  async lockDraw(draw) {
    const updated = await prisma.lottoDraw.update({
      where: { id: draw.id },
      data: { status: 'LOCKED' }
    });
    
    this.io.to(`lotto:${this.room}`).emit('lotto:locked', { drawId: draw.id });
    console.log(`[LottoEngine] Locked draw ${draw.id}`);
    return updated;
  }

  generateWinningNumbers(serverSeed, clientSeed) {
    const hash = crypto.createHmac('sha256', serverSeed).update(clientSeed || '00000000000000000000000000000000').digest('hex');
    
    const pool = Array.from({length: 49}, (_, i) => i + 1);
    const winningNumbers = [];
    
    // Use chunks of the hash to pick and remove numbers from the pool
    for (let i = 0; i < 6; i++) {
      const hexSegment = hash.substring(i * 4, i * 4 + 4);
      const randInt = parseInt(hexSegment, 16);
      
      const selectedIndex = randInt % pool.length;
      winningNumbers.push(pool[selectedIndex]);
      
      // Remove selected number from pool to prevent duplicates
      pool.splice(selectedIndex, 1);
    }
    
    // Sort for presentation
    return winningNumbers.sort((a, b) => a - b);
  }

  async settleDraw(draw) {
    console.log(`[LottoEngine] Settling draw ${draw.id}`);
    
    // 1. Mark as RESULT
    const clientSeed = crypto.randomBytes(16).toString('hex'); // In a real app, combine seeds of last N bets
    const winningNumbers = this.generateWinningNumbers(draw.serverSeed, clientSeed);

    await prisma.lottoDraw.update({
      where: { id: draw.id },
      data: { 
        status: 'RESULT',
        clientSeed,
        winningNumbers
      }
    });

    this.io.to(`lotto:${this.room}`).emit('lotto:result', { 
      drawId: draw.id, 
      winningNumbers 
    });

    // 2. Fetch all tickets and calculate payouts
    const tickets = await prisma.lottoTicket.findMany({ where: { drawId: draw.id } });
    
    for (const ticket of tickets) {
      let matches = 0;
      for (const num of ticket.numbers) {
        if (winningNumbers.includes(num)) matches++;
      }

      const payout = PAYOUTS[matches] || 0n;

      if (matches > 0 || payout > 0n) {
        await prisma.$transaction(async (tx) => {
          // Update ticket
          await tx.lottoTicket.update({
            where: { id: ticket.id },
            data: { matchedCount: matches, payout }
          });

          if (payout > 0n) {
            // Credit wallet
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
          }
        });
      }
    }

    // 3. Mark as SETTLED
    await prisma.lottoDraw.update({
      where: { id: draw.id },
      data: { status: 'SETTLED' }
    });

    console.log(`[LottoEngine] Draw ${draw.id} settled. Total tickets evaluated: ${tickets.length}`);
  }

  async loop() {
    while (this.isRunning) {
      const now = new Date();

      if (this.currentDraw) {
        if (this.currentDraw.status === 'OPEN' && now >= this.currentDraw.lockTime) {
          this.currentDraw = await this.lockDraw(this.currentDraw);
        } else if (this.currentDraw.status === 'LOCKED' && now >= this.currentDraw.resultTime) {
          await this.settleDraw(this.currentDraw);
          this.currentDraw = await this.createNewDraw();
        }
      }

      // Emit tick
      if (this.currentDraw) {
        this.io.to(`lotto:${this.room}`).emit('lotto:tick', {
          drawId: this.currentDraw.id,
          status: this.currentDraw.status,
          lockTime: this.currentDraw.lockTime.getTime(),
          resultTime: this.currentDraw.resultTime.getTime(),
          now: now.getTime()
        });
      }

      // Wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = { LottoEngine, TICKET_PRICE, PAYOUTS };
