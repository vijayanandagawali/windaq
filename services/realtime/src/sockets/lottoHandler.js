const crypto = require('crypto');
const { TICKET_PRICE } = require('../services/lottoEngine');
const { requirePlayer, debitStake, replyError, GameError, prisma } = require('../services/gameBets');

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

  socket.on('lotto:buy', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      if (!lottoEngine) throw new GameError('GAME_UNAVAILABLE', 'Lotto is not available right now.');

      const numbers = Array.isArray(data.numbers) ? data.numbers.map(Number) : [];
      if (numbers.length !== 6 || numbers.some(n => !Number.isInteger(n) || n < 1 || n > 49) || new Set(numbers).size !== 6) {
        throw new GameError('INVALID_BET', 'Pick exactly 6 different numbers from 1 to 49.');
      }

      const draw = lottoEngine.currentDraw;
      if (!draw || !lottoEngine.isBettingAcceptable()) {
        throw new GameError('BETTING_CLOSED', 'Ticket sales are closed for this draw.');
      }

      const ticketId = crypto.randomUUID();
      const sorted = [...numbers].sort((a, b) => a - b);
      const newBalance = await prisma.$transaction(async (tx) => {
        const balance = await debitStake(tx, userId, TICKET_PRICE, 'lotto', ticketId);
        await tx.lottoTicket.create({ data: { id: ticketId, userId, drawId: draw.id, numbers: sorted, stake: TICKET_PRICE } });
        return balance;
      });

      if (typeof callback === 'function') {
        callback({ success: true, data: { ticketId, drawId: draw.id, numbers: sorted, newBalance: Number(newBalance) / 100 } });
      }
    } catch (err) {
      replyError(callback, err, 'Lotto buy');
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
