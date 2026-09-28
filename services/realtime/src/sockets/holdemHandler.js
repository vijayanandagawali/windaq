const holdem = require('../services/casinoHoldem');
const { requirePlayer, replyError, prisma } = require('../services/gameBets');

// Serializes each player's actions so a double tap cannot deal or decide twice concurrently.
const userLocks = new Map();
async function withUserLock(userId, fn) {
  const previous = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  userLocks.set(userId, previous.then(() => current));
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === current) userLocks.delete(userId);
  }
}

async function balanceOf(userId) {
  const wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
  return wallet ? Number(wallet.balance) / 100 : 0;
}

function handleHoldemSockets(socket) {
  // Resume: the player's open hand, if any.
  socket.on('holdem:state', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const hand = await holdem.openHandFor(userId);
      callback({ success: true, hand: holdem.toPublic(hand) });
    } catch (err) {
      replyError(callback, err, 'Holdem state');
    }
  });

  socket.on('holdem:deal', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const hand = await withUserLock(userId, () => holdem.dealHand(userId, { ante: data.ante, clientSeed: data.clientSeed }));
      callback({ success: true, hand: holdem.toPublic(hand), newBalance: await balanceOf(userId) });
    } catch (err) {
      replyError(callback, err, 'Holdem deal');
    }
  });

  socket.on('holdem:decide', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const hand = await withUserLock(userId, () => holdem.decide(userId, data.handId, data.action));
      callback({ success: true, hand: holdem.toPublic(hand), newBalance: await balanceOf(userId) });
    } catch (err) {
      replyError(callback, err, 'Holdem decide');
    }
  });
}

module.exports = { handleHoldemSockets };
