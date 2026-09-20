const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('../services/walletService');
const riskService = require('../services/riskService');
const complianceService = require('../services/complianceService');

function handleTableSockets(socket, io, engines) {
  
  socket.on('tg:join', (data) => {
    const gameId = data?.gameId;
    const room = data?.room || 'Standard';
    if (!gameId) return;

    socket.join(`tg:${gameId}:${room}`);
    console.log(`Client ${socket.id} joined tg:${gameId}:${room}`);

    // If we have an engine for this game, send complete state snapshot immediately
    const engineKey = `${gameId.replace('-', '')}Engine`; // e.g. dragontigerEngine
    const engine = engines[engineKey];
    
    if (engine && engine.currentRound) {
      socket.emit('tg:tick', {
        roundId: engine.currentRound.id,
        gameId: engine.gameId,
        room: engine.room,
        phase: engine.currentPhase,
        phaseTimeLeft: Math.max(0, engine.phaseTimeLeft),
        totalPhaseDuration: engine.totalPhaseDuration,
        phaseEndsAt: engine.phaseEndsAt,
        dealer: engine.dealer,
        result: (engine.currentPhase === 'RESULT' || engine.currentPhase === 'SETTLEMENT' || engine.currentPhase === 'NEXT_ROUND') ? engine.currentResult : null,
        dealingStep: engine.dealingStep,
        serverSeedHash: engine.currentRound.serverSeedHash,
        serverSeed: (engine.currentPhase === 'RESULT' || engine.currentPhase === 'SETTLEMENT' || engine.currentPhase === 'NEXT_ROUND') ? engine.currentRound.serverSeed : null,
        clientSeed: (engine.currentPhase === 'RESULT' || engine.currentPhase === 'SETTLEMENT' || engine.currentPhase === 'NEXT_ROUND') ? engine.clientSeed : null,
        history: engine.recentHistory?.slice(0, 20) || [],
        now: Date.now()
      });
    }
  });

  socket.on('tg:leave', (data) => {
    const gameId = data?.gameId;
    const room = data?.room || 'Standard';
    if (gameId) socket.leave(`tg:${gameId}:${room}`);
  });

  socket.on('tg:bet', async (data, callback) => {
    const { userId = 'guest', gameId, room = 'Standard', market, amount } = data;
    const betAmount = BigInt(Math.floor(amount * 100)); // converting to paise

    if (betAmount < 1000n) { // Minimum 10 INR
      return callback({ success: false, message: 'Minimum bet is ₹10.' });
    }

    const engineKey = `${gameId?.replace('-', '')}Engine`;
    const engine = engines[engineKey];

    // Server-authoritative phase check
    if (engine && engine.currentPhase !== 'BETTING_OPEN') {
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

      // Broadcast bet to room for live ticker/chips
      io.to(`tg:${gameId}:${room}`).emit('tg:live_bet', {
        userId: userId.substring(0,4) + '***',
        market,
        amount
      });

      callback({ success: true, data: result });
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
