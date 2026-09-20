const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function handleDiceSockets(socket, io, engines) {
  const diceEngine = engines.diceEngine;

  socket.on('dice:join', (data) => {
    const room = data?.room || '1min';
    socket.join(`dice:${room}`);
    console.log(`Client ${socket.id} joined dice:${room}`);

    if (diceEngine && diceEngine.currentRoll) {
      socket.emit('dice:tick', {
        rollId: diceEngine.currentRoll.id,
        status: diceEngine.currentRoll.status,
        lockTime: diceEngine.currentRoll.lockTime.getTime(),
        resultTime: diceEngine.currentRoll.resultTime.getTime(),
        now: Date.now()
      });
    }
  });

  socket.on('dice:leave', (data) => {
    const room = data?.room || '1min';
    socket.leave(`dice:${room}`);
  });

  socket.on('dice:bet', async (data, callback) => {
    const { userId, room, market, amount } = data;
    const betAmount = BigInt(amount * 100); // converting to paise

    if (betAmount < 1000n) { // Minimum 10 INR
      return callback({ success: false, message: 'Minimum bet is ₹10.' });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const roll = await tx.diceRoll.findFirst({
          where: { room: room || '1min', status: 'OPEN' },
          orderBy: { startTime: 'desc' }
        });

        if (!roll) throw new Error('No open round available.');
        if (new Date() >= roll.lockTime) throw new Error('Round is locked.');

        let wallet = await tx.wallet.findFirst({ where: { userId, currency: 'INR' } });
        if (!wallet) {
          const autoPhone = `+9198${Math.abs(userId.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) % 100000000).toString().padStart(8, '0')}`;
          await tx.user.upsert({
            where: { id: userId },
            update: {},
            create: { id: userId, phone: autoPhone }
          });
          wallet = await tx.wallet.create({
            data: { userId, currency: 'INR', balance: 1000000n }
          });
        }

        if (wallet.balance < betAmount) throw new Error('Insufficient balance.');

        const newBalance = wallet.balance - betAmount;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

        const bet = await tx.diceBet.create({
          data: {
            userId,
            rollId: roll.id,
            market,
            amount: betAmount
          }
        });

        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `dice-bet-${bet.id}`,
            type: 'BET_PLACE',
            amount: betAmount,
            balanceAfter: newBalance,
            reference: bet.id
          }
        });

        return {
          betId: bet.id,
          rollId: roll.id,
          market,
          newBalance: newBalance.toString()
        };
      });

      // Broadcast bet to room for live ticker
      io.to(`dice:${room || '1min'}`).emit('dice:live_bet', {
        userId: userId.substring(0,4) + '***',
        market,
        amount
      });

      callback({ success: true, data: result });
    } catch (e) {
      console.error('Dice bet error:', e);
      callback({ success: false, message: e.message });
    }
  });

  socket.on('dice:history', async (data, callback) => {
    try {
      const room = data?.room || '1min';
      const history = await prisma.diceRoll.findMany({
        where: { room, status: 'SETTLED' },
        orderBy: { resultTime: 'desc' },
        take: 15
      });
      callback({ success: true, data: history });
    } catch (e) {
      callback({ success: false, message: 'Failed to fetch history' });
    }
  });
}

module.exports = { handleDiceSockets };
