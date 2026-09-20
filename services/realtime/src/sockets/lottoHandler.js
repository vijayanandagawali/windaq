const { PrismaClient } = require('@prisma/client');
const { TICKET_PRICE } = require('../services/lottoEngine');
const { ensureUserAndWallet } = require('../services/walletService');
const prisma = new PrismaClient();

function handleLottoSockets(socket, io, engines) {
  const lottoEngine = engines.lottoEngine; // Assuming we pass it down

  socket.on('lotto:join', (data) => {
    const room = data?.room || '5min';
    socket.join(`lotto:${room}`);
    console.log(`Client ${socket.id} joined lotto:${room}`);

    // Send current state
    if (lottoEngine && lottoEngine.currentDraw) {
      socket.emit('lotto:tick', {
        drawId: lottoEngine.currentDraw.id,
        status: lottoEngine.currentDraw.status,
        lockTime: lottoEngine.currentDraw.lockTime.getTime(),
        resultTime: lottoEngine.currentDraw.resultTime.getTime(),
        now: Date.now()
      });
    }
  });

  socket.on('lotto:leave', (data) => {
    const room = data?.room || '5min';
    socket.leave(`lotto:${room}`);
  });

  socket.on('lotto:buy', async (data, callback) => {
    const { userId, room, numbers } = data;
    
    if (!numbers || numbers.length !== 6) {
      return callback({ success: false, message: 'Exactly 6 numbers required.' });
    }
    
    // Validate uniqueness and range (1-49)
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== 6) return callback({ success: false, message: 'Numbers must be unique.' });
    
    for (const n of numbers) {
      if (n < 1 || n > 49) return callback({ success: false, message: 'Numbers must be between 1 and 49.' });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Fetch current active draw
        const draw = await tx.lottoDraw.findFirst({
          where: { room: room || '5min', status: 'OPEN' },
          orderBy: { startTime: 'desc' }
        });

        if (!draw) {
          throw new Error('No open draw available right now.');
        }

        if (new Date() >= draw.lockTime) {
          throw new Error('Draw is locked. Please wait for the next round.');
        }

        // Fetch wallet, auto-provision guest for testing if needed
        let { wallet } = await ensureUserAndWallet(tx, userId);

        if (wallet.balance < TICKET_PRICE) {
          throw new Error('Insufficient balance in wallet.');
        }

        // Deduct ticket price
        const newBalance = wallet.balance - TICKET_PRICE;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

        // Record Ticket
        const ticket = await tx.lottoTicket.create({
          data: {
            userId,
            drawId: draw.id,
            numbers: numbers.sort((a,b) => a-b),
            stake: TICKET_PRICE
          }
        });

        // Record Financial Transaction
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `lotto-buy-${ticket.id}`,
            type: 'BET_PLACE',
            amount: TICKET_PRICE,
            balanceAfter: newBalance,
            reference: ticket.id
          }
        });

        return {
          ticketId: ticket.id,
          drawId: draw.id,
          numbers: ticket.numbers,
          newBalance: newBalance.toString()
        };
      });

      callback({ success: true, data: result });
    } catch (e) {
      console.error('Lotto buy error:', e);
      callback({ success: false, message: e.message });
    }
  });

  socket.on('lotto:history', async (data, callback) => {
    try {
      const room = data?.room || '5min';
      const history = await prisma.lottoDraw.findMany({
        where: { room, status: 'SETTLED' },
        orderBy: { resultTime: 'desc' },
        take: 10
      });
      callback({ success: true, data: history });
    } catch (e) {
      callback({ success: false, message: 'Failed to fetch history' });
    }
  });
}

module.exports = { handleLottoSockets };
