const crypto = require('crypto');
const BlackjackEngine = require('../services/tableGames/BlackjackEngine');
const { requirePlayer, parseStake, debitStake, refundBet, replyError, GameError, prisma } = require('../services/gameBets');

const MIN_BET = 10;
const MAX_BET = 50000;

// Serializes actions per game so double-clicks or parallel requests cannot race on the shoe.
const gameLocks = new Map();
async function withGameLock(gameId, fn) {
  const previous = gameLocks.get(gameId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  gameLocks.set(gameId, previous.then(() => current));
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (gameLocks.get(gameId) === current) gameLocks.delete(gameId);
  }
}

async function loadOwnedGame(gameId, userId) {
  const game = typeof gameId === 'string' ? await BlackjackEngine.getGame(gameId) : null;
  if (!game || game.userId !== userId) throw new GameError('NOT_FOUND', 'Game not found.');
  return game;
}

// Signature matches the call site in sockets/index.js: (socket, io).
const handleBlackjackSockets = (socket, io) => {
  socket.on('bj:join', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const game = await BlackjackEngine.createGame(userId);
      socket.join(`bj_${game.id}`);
      callback({ success: true, gameId: game.id, state: BlackjackEngine.toPublicState({ ...game, hands: [] }) });
    } catch (err) {
      replyError(callback, err, 'Blackjack join');
    }
  });

  socket.on('bj:bet', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const betPaise = parseStake(data.amount, { min: MIN_BET, max: MAX_BET });
      const previous = await loadOwnedGame(data.gameId, userId);

      const state = await withGameLock(previous.id, async () => {
        // Each round is its own game record; a settled table starts a fresh round on the same shoe.
        let game = await BlackjackEngine.getGame(previous.id);
        if (game.status === 'SETTLED') {
          game = await BlackjackEngine.createGame(userId, game.shoe);
          socket.join(`bj_${game.id}`);
        } else if (game.status !== 'BETTING') {
          throw new GameError('ROUND_IN_PROGRESS', 'Finish the current hand first.');
        }

        // Claim the round atomically so a duplicate bet cannot deal twice.
        const claimed = await prisma.blackjackGame.updateMany({ where: { id: game.id, status: 'BETTING' }, data: { status: 'DEALING' } });
        if (claimed.count !== 1) throw new GameError('ROUND_IN_PROGRESS', 'This hand is already being dealt.');

        const handId = crypto.randomUUID();
        await prisma.$transaction((tx) => debitStake(tx, userId, betPaise, 'blackjack', handId));
        try {
          return await BlackjackEngine.dealInitialCards(game.id, betPaise, handId);
        } catch (err) {
          await refundBet(userId, betPaise, 'blackjack', handId);
          await prisma.blackjackGame.update({ where: { id: game.id }, data: { status: 'BETTING' } });
          throw err;
        }
      });

      const wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
      const publicState = BlackjackEngine.toPublicState(state);
      callback({ success: true, gameId: state.id, state: publicState, newBalance: Number(wallet.balance) / 100 });
      if (state.status === 'SETTLED') io.to(`bj_${state.id}`).emit('bj:state', publicState);
    } catch (err) {
      replyError(callback, err, 'Blackjack bet');
    }
  });

  socket.on('bj:action', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const actionType = String(data.actionType || '').toUpperCase();
      if (actionType !== 'HIT' && actionType !== 'STAND') throw new GameError('INVALID_ACTION', 'Unsupported action.');
      const owned = await loadOwnedGame(data.gameId, userId);

      const game = await withGameLock(owned.id, async () => {
        const current = await BlackjackEngine.getGame(owned.id);
        const hand = current.hands[current.activeHandIndex];
        if (current.status !== 'PLAYING' || !hand || hand.id !== data.handId || hand.status !== 'PLAYING') {
          throw new GameError('INVALID_ACTION', 'That hand cannot act right now.');
        }
        return actionType === 'HIT'
          ? BlackjackEngine.hit(current.id, hand.id)
          : BlackjackEngine.stand(current.id, hand.id);
      });

      const publicState = BlackjackEngine.toPublicState(game);
      callback({ success: true, state: publicState });
      if (game.status === 'SETTLED') io.to(`bj_${game.id}`).emit('bj:state', publicState);
    } catch (err) {
      replyError(callback, err, 'Blackjack action');
    }
  });
};

module.exports = { handleBlackjackSockets };
