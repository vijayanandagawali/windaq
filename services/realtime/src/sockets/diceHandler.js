const crypto = require('crypto');
const { PAYOUTS: DICE_PAYOUTS } = require('../services/diceEngine');
const { requirePlayer, parseStake, debitStake, replyError, GameError, prisma } = require('../services/gameBets');

function handleDiceSockets(socket, io, engines) {
  const diceEngine = engines.diceEngine;

  socket.on('dice:join', (data) => {
    const room = data?.room || '1min';
    socket.join(`dice:${room}`);
    console.log(`Client ${socket.id} joined dice:${room}`);

    if (diceEngine && diceEngine.currentRoll) {
      socket.emit('dice:tick', {
        rollId: diceEngine.roundId,
        roundId: diceEngine.roundId,
        phase: diceEngine.currentPhase,
        ...diceEngine.getBettingClock(),
        resultTime: diceEngine.phaseEndsAt
      });
    }
  });

  socket.on('dice:leave', (data) => {
    const room = data?.room || '1min';
    socket.leave(`dice:${room}`);
  });

  socket.on('dice:bet', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      if (!diceEngine) throw new GameError('GAME_UNAVAILABLE', 'Dice is not available right now.');
      const market = String(data.market || '').toUpperCase();
      if (!DICE_PAYOUTS[market]) throw new GameError('INVALID_BET', 'Invalid dice market.');
      // The page sends rupees.
      const amountPaise = parseStake(data.amount, { min: diceEngine.minBet, max: diceEngine.maxBet });

      const roll = diceEngine.currentRoll;
      if (!roll || !diceEngine.isBettingAcceptable()) {
        throw new GameError('BETTING_CLOSED', 'Betting is closed for this roll.');
      }

      const betId = crypto.randomUUID();
      const newBalance = await prisma.$transaction(async (tx) => {
        const balance = await debitStake(tx, userId, amountPaise, 'dice', betId);
        await tx.diceBet.create({ data: { id: betId, userId, rollId: roll.id, market, amount: amountPaise } });
        return balance;
      });

      if (typeof callback === 'function') {
        callback({ success: true, data: { betId, rollId: roll.id, market, newBalance: Number(newBalance) / 100 } });
      }
    } catch (err) {
      replyError(callback, err, 'Dice bet');
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
