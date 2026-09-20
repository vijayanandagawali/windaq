const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('../walletService');

class LiveRouletteEngine {
  constructor(io) {
    this.io = io;
  }

  // Called by Dealer Console
  async openBetting(tableId, dealerId) {
    // Check if there's already an open round
    const activeRound = await prisma.liveRound.findFirst({
      where: { tableId, status: { in: ['BETTING_OPEN', 'BETTING_CLOSED', 'RESULT_PENDING'] } }
    });

    if (activeRound) throw new Error("A round is already active on this table.");

    const round = await prisma.liveRound.create({
      data: {
        tableId,
        dealerId,
        status: 'BETTING_OPEN'
      }
    });

    this.io.to(`live_${tableId}`).emit('live:state', {
      tableId,
      status: 'BETTING_OPEN',
      roundId: round.id,
      timestamp: Date.now()
    });

    return round;
  }

  async closeBetting(tableId) {
    const round = await prisma.liveRound.findFirst({
      where: { tableId, status: 'BETTING_OPEN' },
      orderBy: { startTime: 'desc' }
    });

    if (!round) throw new Error("No open betting round found.");

    await prisma.liveRound.update({
      where: { id: round.id },
      data: { status: 'BETTING_CLOSED' }
    });

    this.io.to(`live_${tableId}`).emit('live:state', {
      tableId,
      status: 'BETTING_CLOSED',
      roundId: round.id,
      timestamp: Date.now()
    });

    return round;
  }

  async submitResult(tableId, resultNumber) {
    const round = await prisma.liveRound.findFirst({
      where: { tableId, status: 'BETTING_CLOSED' },
      orderBy: { startTime: 'desc' }
    });

    if (!round) throw new Error("Round must be closed before submitting result.");

    await prisma.liveRound.update({
      where: { id: round.id },
      data: { status: 'RESULT_PENDING', result: { number: resultNumber } }
    });

    this.io.to(`live_${tableId}`).emit('live:state', {
      tableId,
      status: 'RESULT_PENDING',
      roundId: round.id,
      result: { number: resultNumber },
      timestamp: Date.now()
    });

    return round;
  }

  async settleRound(tableId) {
    const round = await prisma.liveRound.findFirst({
      where: { tableId, status: 'RESULT_PENDING' },
      orderBy: { startTime: 'desc' }
    });

    if (!round || !round.result) throw new Error("No pending result to settle.");

    const resultNumber = round.result.number;

    // Fetch all bets
    const bets = await prisma.liveBet.findMany({ where: { roundId: round.id } });

    for (const bet of bets) {
      const targets = bet.targets; // e.g. [32] or [1,2,3...12]
      let multiplier = 0;

      if (targets.includes(resultNumber)) {
        if (bet.market === 'STRAIGHT') multiplier = 36;
        else if (bet.market === 'SPLIT') multiplier = 18;
        else if (bet.market === 'STREET') multiplier = 12;
        else if (bet.market === 'CORNER') multiplier = 9;
        else if (bet.market === 'LINE') multiplier = 6;
        else if (bet.market === 'COLUMN' || bet.market === 'DOZEN') multiplier = 3;
        else if (bet.market === 'RED' || bet.market === 'BLACK' || bet.market === 'EVEN' || bet.market === 'ODD' || bet.market === 'LOW' || bet.market === 'HIGH') multiplier = 2;
      }

      if (multiplier > 0) {
        const payout = BigInt(Number(bet.amount) * multiplier);
        
        await prisma.$transaction(async (tx) => {
          await tx.liveBet.update({
            where: { id: bet.id },
            data: { status: 'WON', payout }
          });
          await walletService.settleWin(tx, bet.userId, bet.amount, payout, 'BET_WIN', bet.id);
        });
      } else {
         await prisma.$transaction(async (tx) => {
           await tx.liveBet.update({
              where: { id: bet.id },
              data: { status: 'LOST' }
           });
           await walletService.settleLoss(tx, bet.userId, bet.amount, 'BET_LOSS', bet.id);
         });
      }
    }

    await prisma.liveRound.update({
      where: { id: round.id },
      data: { status: 'SETTLED', endTime: new Date() }
    });

    this.io.to(`live_${tableId}`).emit('live:state', {
      tableId,
      status: 'SETTLED',
      roundId: round.id,
      result: { number: resultNumber },
      timestamp: Date.now()
    });

    return round;
  }
  
  // --- PLAYER ACTIONS ---
  
  async placeBet(userId, tableId, market, targets, amount) {
    const betAmount = BigInt(amount * 100);

    const result = await prisma.$transaction(async (tx) => {
      const round = await tx.liveRound.findFirst({
        where: { tableId, status: 'BETTING_OPEN' },
        orderBy: { startTime: 'desc' }
      });

      if (!round) throw new Error("Betting is currently closed.");

      await walletService.ensureUserAndWallet(tx, userId);

      const bet = await tx.liveBet.create({
        data: {
          userId,
          roundId: round.id,
          market,
          targets,
          amount: betAmount
        }
      });

      const newBalance = await walletService.placeBet(tx, userId, betAmount, 'BET_PLACE', bet.id);

      return {
        betId: bet.id,
        newBalance: newBalance.toString()
      };
    });

    // Notify dealer console and other players of live action
    this.io.to(`live_${tableId}`).emit('live:live_bet', {
      userId: userId.substring(0,4) + '***',
      market,
      amount
    });

    return result;
  }
  
  // --- AUTOMATED SANDBOX SIMULATION ---
  async startAutomatedDealer(tableId) {
    console.log(`🎰 Starting Automated Live Dealer for table: ${tableId}`);

    try {
      // Ensure automated dealer exists in database to satisfy foreign key constraint
      let dealer = await prisma.liveDealer.findFirst({ where: { pinCode: 'AUTO' } });
      if (!dealer) {
        dealer = await prisma.liveDealer.create({
          data: { name: 'AI Dealer Aria', pinCode: 'AUTO' }
        });
      }
      const autoDealerId = dealer.id;

      // Clean up any stale active rounds from previous server runs
      await prisma.liveRound.updateMany({
        where: { tableId, status: { in: ['BETTING_OPEN', 'BETTING_CLOSED', 'RESULT_PENDING'] } },
        data: { status: 'CANCELLED', endTime: new Date() }
      });

      const loop = async () => {
        try {
          console.log(`[Auto-Dealer] Opening bets for ${tableId}...`);
          await this.openBetting(tableId, autoDealerId);
          
          // Wait 15 seconds for players to bet
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          console.log(`[Auto-Dealer] Closing bets for ${tableId}...`);
          await this.closeBetting(tableId);
          
          // Wait 5 seconds for ball to spin
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Generate result
          const resultNumber = Math.floor(Math.random() * 37); // 0-36
          console.log(`[Auto-Dealer] Result generated: ${resultNumber}`);
          await this.submitResult(tableId, resultNumber);
          
          // Wait 2 seconds
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          console.log(`[Auto-Dealer] Settling round...`);
          await this.settleRound(tableId);
          
          // Wait 5 seconds before next round
          await new Promise(resolve => setTimeout(resolve, 5000));
          
        } catch (err) {
          console.error(`[Auto-Dealer] Error in automated loop:`, err.message);
          // Wait a bit before retrying on error
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Next loop iteration
        setImmediate(loop);
      };
      
      // Start loop
      loop();
    } catch (bootErr) {
      console.error(`[Auto-Dealer] Boot error:`, bootErr.message);
    }
  }
}

module.exports = LiveRouletteEngine;
