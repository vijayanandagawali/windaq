const crypto = require('crypto');
const { requirePlayer, parseStake, debitStake, replyError, GameError, prisma } = require('../services/gameBets');
const { validateRouletteBet } = require('../services/rouletteBets');

function handleRouletteSockets(socket, io, engines) {
  
  socket.on('roulette:join', (data) => {
    const room = data?.room || 'Auto';
    socket.join(`roulette:${room}`);
    console.log(`Client ${socket.id} joined roulette:${room}`);

    const engine = engines.rouletteEngine;
    if (engine) engine.emitLegacyTick();
  });

  socket.on('roulette:leave', (data) => {
    const room = data?.room || 'Auto';
    socket.leave(`roulette:${room}`);
  });

  socket.on('roulette:bet', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const engine = engines.rouletteEngine;
      if (!engine) throw new GameError('GAME_UNAVAILABLE', 'Roulette is not available right now.');

      // Targets are recomputed/validated server-side; the client cannot choose what a market covers.
      const { market, targets } = validateRouletteBet(data.market, data.targets);
      const amountPaise = parseStake(data.amount, { min: engine.minBet, max: engine.maxBet });

      const roll = engine.legacyRoll;
      if (!roll || roll.id !== engine.roundId || !engine.isBettingAcceptable()) {
        throw new GameError('BETTING_CLOSED', 'Betting is closed for this spin.');
      }

      const betId = crypto.randomUUID();
      const newBalance = await prisma.$transaction(async (tx) => {
        const balance = await debitStake(tx, userId, amountPaise, 'roulette', betId);
        await tx.rouletteBet.create({ data: { id: betId, userId, rollId: roll.id, marketType: market, targets, amount: amountPaise } });
        return balance;
      });

      io.to(`roulette:${data.room || 'Auto'}`).emit('roulette:live_bet', { market, amount: Number(amountPaise) / 100 });
      if (typeof callback === 'function') {
        callback({ success: true, data: { betId, roundId: roll.id, market, targets, newBalance: Number(newBalance) / 100 } });
      }
    } catch (err) {
      replyError(callback, err, 'Roulette bet');
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
