const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ensureUserAndWallet } = require('../services/walletService');

function handleRouletteSockets(socket, io, engines) {
  
  socket.on('roulette:join', (data) => {
    const room = data?.room || 'Auto';
    socket.join(`roulette:${room}`);
    console.log(`Client ${socket.id} joined roulette:${room}`);

    const engine = engines.rouletteEngine;
    
    if (engine && engine.currentRound) {
      socket.emit('roulette:tick', {
        roundId: engine.currentRound.id,
        status: engine.currentRound.status,
        lockTime: engine.currentRound.lockTime.getTime(),
        resultTime: engine.currentRound.resultTime.getTime(),
        now: Date.now()
      });
    }
  });

  socket.on('roulette:leave', (data) => {
    const room = data?.room || 'Auto';
    socket.leave(`roulette:${room}`);
  });

  socket.on('roulette:bet', async (data, callback) => {
    const resolvedUserId = (socket.user?.id && socket.user.id !== 'guest') ? socket.user.id : (process.env.NODE_ENV === 'test' && data?.userId ? data.userId : null);
    if (!resolvedUserId) {
      return callback({ success: false, code: 'AUTH_REQUIRED', message: 'You must be logged in to place bets.' });
    }
    const userId = resolvedUserId;
    const { room = 'Auto', market, targets, amount } = data;
    const betAmount = BigInt(amount * 100); // convert INR to paise

    if (betAmount < 1000n) { // Minimum 10 INR
      return callback({ success: false, message: 'Minimum bet is ₹10.' });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const round = await tx.rouletteRoll.findFirst({
          where: { room, status: 'OPEN' },
          orderBy: { startTime: 'desc' }
        });

        if (!round) throw new Error('No open round available.');
        if (new Date() >= round.lockTime) throw new Error('Round is locked.');

        let { wallet } = await ensureUserAndWallet(tx, userId);

        if (wallet.balance < betAmount) throw new Error('Insufficient balance.');

        const newBalance = wallet.balance - betAmount;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

        const bet = await tx.rouletteBet.create({
          data: {
            userId,
            rollId: round.id,
            marketType: market,
            targets: targets, // e.g. [0], [1,2,3]
            amount: betAmount
          }
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `roulette-bet-${bet.id}`,
            type: 'BET_PLACE',
            amount: betAmount,
            balanceAfter: newBalance,
            reference: bet.id
          }
        });

        return {
          betId: bet.id,
          roundId: round.id,
          market,
          targets,
          newBalance: newBalance.toString()
        };
      });

      // Broadcast bet to room for live ticker/chips
      io.to(`roulette:${room}`).emit('roulette:live_bet', {
        userId: userId.substring(0,4) + '***',
        market,
        targets,
        amount
      });

      callback({ success: true, data: result });
    } catch (e) {
      console.error('Roulette bet error:', e);
      callback({ success: false, message: e.message });
    }
  });

  socket.on('roulette:history', async (data, callback) => {
    try {
      const { room = 'Auto' } = data;
      const history = await prisma.rouletteRoll.findMany({
        where: { room, status: 'SETTLED' },
        orderBy: { resultTime: 'desc' },
        take: 20
      });
      callback({ success: true, data: history });
    } catch (e) {
      callback({ success: false, message: 'Failed to fetch history' });
    }
  });
}

module.exports = { handleRouletteSockets };
