const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('../services/walletService');
const riskService = require('../services/riskService');
const complianceService = require('../services/complianceService');

function handleTableSockets(socket, io, engines) {
  
  // Handler for joining a table game room
  const handleJoin = (data) => {
    const gameId = data?.gameId;
    const room = data?.room || 'Standard';
    const userId = data?.userId || socket.user?.id || 'guest';
    if (!gameId) return;

    socket.join(`tg:${gameId}:${room}`);
    socket.join(`${gameId}:${room}`);
    console.log(`Client ${socket.id} joined tg:${gameId}:${room} (user: ${userId})`);

    // Retrieve engine
    const engineKey = `${gameId.replace('-', '')}Engine`;
    const engine = engines[engineKey];
    
    if (engine) {
      const snapshot = engine.getSnapshot(userId);
      // Emit full snapshot for immediate rehydration on refresh
      socket.emit('tg:snapshot', snapshot);
      socket.emit('round:snapshot', snapshot);
      socket.emit('tg:tick', snapshot);
      socket.emit('round:tick', snapshot);
    }
  };

  socket.on('tg:join', handleJoin);
  socket.on('round:join', handleJoin);

  socket.on('tg:leave', (data) => {
    const gameId = data?.gameId;
    const room = data?.room || 'Standard';
    if (gameId) {
      socket.leave(`tg:${gameId}:${room}`);
      socket.leave(`${gameId}:${room}`);
    }
  });

  socket.on('round:leave', (data) => {
    const gameId = data?.gameId;
    const room = data?.room || 'Standard';
    if (gameId) {
      socket.leave(`tg:${gameId}:${room}`);
      socket.leave(`${gameId}:${room}`);
    }
  });

  // Handle Bet placement
  socket.on('tg:bet', async (data, callback) => {
    const { userId = socket.user?.id || 'guest', gameId, room = 'Standard', market, amount } = data;
    const betAmount = BigInt(Math.floor(amount * 100)); // converting to paise

    if (betAmount < 1000n) { // Minimum 10 INR
      return callback({ success: false, message: 'Minimum bet is ₹10.' });
    }

    const engineKey = `${gameId?.replace('-', '')}Engine`;
    const engine = engines[engineKey];

    // Server-authoritative phase check
    if (engine && !engine.isBettingAcceptable()) {
      return callback({ success: false, message: 'Betting is currently closed for this round.' });
    }

    try {
      // Compliance Gate: Check KYC, Limits, Jurisdictions, and Self-Exclusions
      await complianceService.checkEligibility(userId, 'CASINO', betAmount);

      const result = await prisma.$transaction(async (tx) => {
        const round = await tx.tableGameRound.findFirst({
          where: { gameId, room, status: 'OPEN' },
          orderBy: { startTime: 'desc' }
        });

        if (!round) {
          await riskService.flagUser(userId, 'IMPOSSIBLE_STATE', { action: 'tg:bet', error: 'No open round', gameId, room }, 'HIGH');
          throw new Error('No open round available.');
        }

        await walletService.ensureUserAndWallet(tx, userId);

        const bet = await tx.tableGameBet.create({
          data: {
            userId,
            roundId: round.id,
            gameId,
            market,
            amount: betAmount
          }
        });

        const newBalance = await walletService.placeBet(tx, userId, betAmount, 'BET_PLACE', bet.id);

        return {
          betId: bet.id,
          roundId: round.id,
          market,
          amount,
          newBalance: newBalance.toString()
        };
      });

      // Record in-memory active bets for instant refresh recovery
      if (engine) {
        engine.recordBet(userId, market, amount);
      }

      const activeUserBets = engine ? engine.getUserBets(userId) : { [market]: amount };

      // Broadcast live bet to room for table chips animation
      io.to(`tg:${gameId}:${room}`).emit('tg:live_bet', {
        userId: userId.substring(0, 4) + '***',
        market,
        amount
      });

      // Emit round:bet_accepted to the placing socket
      socket.emit('round:bet_accepted', {
        roundId: result.roundId,
        betId: result.betId,
        market,
        amount,
        myBets: activeUserBets
      });

      callback({ success: true, data: { ...result, myBets: activeUserBets } });
    } catch (e) {
      console.error('Table Game bet error:', e);
      const isDuplicate = await riskService.checkIdempotencyError(e, userId, 'tg:bet', data);
      if (isDuplicate) {
        return callback({ success: false, message: 'Duplicate bet detected.' });
      }
      callback({ success: false, message: e.message });
    }
  });

  socket.on('tg:history', async (data, callback) => {
    try {
      const { gameId, room = 'Standard' } = data;
      const history = await prisma.tableGameRound.findMany({
        where: { gameId, room, status: 'SETTLED' },
        orderBy: { resultTime: 'desc' },
        take: 20
      });
      callback({ success: true, data: history });
    } catch (e) {
      callback({ success: false, message: 'Failed to fetch history' });
    }
  });
}

module.exports = { handleTableSockets };
