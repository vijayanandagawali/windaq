const { PrismaClient } = require('@prisma/client');
const { ensureUserAndWallet } = require('../services/walletService');
const prisma = new PrismaClient();

function handleColourSockets(socket, io) {
  // Join specific room
  socket.on('colour:join', async ({ room }) => {
    socket.join(`colour:${room}`);
    console.log(`Client ${socket.id} joined room: colour:${room}`);
    
    // Send recent history for this room
    try {
      const history = await prisma.colourRound.findMany({
        where: { room: room, state: 'SETTLED' },
        orderBy: { period: 'desc' },
        take: 10
      });
      // Convert BigInt period to string
      const serializedHistory = history.map(h => ({
        ...h,
        period: h.period.toString()
      }));
      socket.emit('colour:history', serializedHistory);
    } catch (e) {
      console.error('Error fetching colour history', e);
    }
  });

  socket.on('colour:leave', ({ room }) => {
    socket.leave(`colour:${room}`);
  });

  // Handle bet placement
  socket.on('colour:bet', async (data, callback) => {
    const { userId, room, betType, betValue, amount } = data;
    
    try {
      // Find active round
      const round = await prisma.colourRound.findFirst({
        where: { room, state: 'BETTING_OPEN' },
        orderBy: { period: 'desc' }
      });

      if (!round) {
        return callback({ success: false, message: 'Betting is closed or round not found' });
      }

      // Calculate multiplier based on bet type
      let multiplier = 2; // Default for color and size (red, green, big, small)
      if (betType === 'color' && betValue === 'violet') multiplier = 4.5;
      if (betType === 'number') multiplier = 9;

      const bet = await prisma.$transaction(async (tx) => {
        // Fetch wallet, or create if guest
        let { wallet } = await ensureUserAndWallet(tx, userId);
        
        if (wallet.balance < amount) {
          throw new Error('Insufficient balance in wallet.');
        }

        // Deduct balance
        const newBalance = BigInt(wallet.balance) - BigInt(amount);
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

        // Record Bet
        const newBet = await tx.colourBet.create({
          data: {
            userId,
            roundId: round.id,
            betType,
            betValue,
            amount: BigInt(amount),
            multiplier
          }
        });

        // Record Transaction
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `bet-${newBet.id}`,
            type: 'BET_PLACE',
            amount: BigInt(amount),
            balanceAfter: newBalance,
            reference: newBet.id
          }
        });

        return newBet;
      });

      callback({ success: true, betId: bet.id });
    } catch (e) {
      console.error('Bet error', e);
      callback({ success: false, message: e.message });
    }
  });
}

module.exports = { handleColourSockets };
