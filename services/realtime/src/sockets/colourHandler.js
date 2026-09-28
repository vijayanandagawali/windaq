const crypto = require('crypto');
const { requirePlayer, parseStake, debitStake, replyError, GameError, prisma } = require('../services/gameBets');

// Payout multipliers (stake included) shown on the table.
const COLOUR_VALUES = new Set(['red', 'green', 'violet']);
const SIZE_VALUES = new Set(['big', 'small']);

function resolveBet(betType, betValue) {
  const value = String(betValue ?? '').toLowerCase();
  if (betType === 'color' && COLOUR_VALUES.has(value)) return { value, multiplier: value === 'violet' ? 4.5 : 2 };
  if (betType === 'size' && SIZE_VALUES.has(value)) return { value, multiplier: 2 };
  if (betType === 'number' && /^[0-9]$/.test(value)) return { value, multiplier: 9 };
  throw new GameError('INVALID_BET', 'Invalid bet selection.');
}

/**
 * @param {Record<string, import('../services/colourEngine')>} colourEngines engines keyed by room ('1min', '3min')
 */
function handleColourSockets(socket, io, colourEngines = {}) {
  socket.on('colour:join', async ({ room } = {}) => {
    if (!colourEngines[room]) return;
    socket.join(`colour:${room}`);
    try {
      const history = await prisma.colourRound.findMany({
        where: { room, state: 'SETTLED' },
        orderBy: { period: 'desc' },
        take: 10
      });
      socket.emit('colour:history', history.map(h => ({ ...h, period: h.period.toString(), nonce: h.nonce })));
    } catch (e) {
      console.error('Error fetching colour history', e.message);
    }
  });

  socket.on('colour:leave', ({ room } = {}) => {
    socket.leave(`colour:${room}`);
  });

  socket.on('colour:bet', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const engine = colourEngines[data.room];
      if (!engine) throw new GameError('INVALID_ROOM', 'Unknown game room.');

      const { value, multiplier } = resolveBet(data.betType, data.betValue);
      // The page sends paise; limits are in rupees.
      const amountPaise = parseStake(data.amount, { unit: 'paise', min: engine.minBet, max: engine.maxBet });

      // Betting is decided by the server's live round state, not by the database row.
      const round = engine.dbRound;
      if (!round || !engine.isBettingAcceptable()) {
        throw new GameError('BETTING_CLOSED', 'Betting is closed for this round.');
      }

      const betId = crypto.randomUUID();
      const newBalance = await prisma.$transaction(async (tx) => {
        const balance = await debitStake(tx, userId, amountPaise, 'colour', betId);
        await tx.colourBet.create({
          data: { id: betId, userId, roundId: round.id, betType: data.betType, betValue: value, amount: amountPaise, multiplier }
        });
        return balance;
      });

      if (typeof callback === 'function') {
        callback({ success: true, betId, period: engine.period.toString(), newBalance: Number(newBalance) / 100 });
      }
    } catch (err) {
      replyError(callback, err, 'Colour bet');
    }
  });
}

module.exports = { handleColourSockets };
