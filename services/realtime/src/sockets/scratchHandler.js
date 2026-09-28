const { ScratchEngine, TIERS } = require('../services/scratchEngine');
const { requirePlayer, debitStake, settleBet, replyError, GameError, prisma } = require('../services/gameBets');

const engine = new ScratchEngine();
const AUTO_SETTLE_AFTER_MS = 15 * 60 * 1000;

/**
 * Settles a ticket exactly once: flips isRevealed atomically, then pays through the ledger
 * (idempotent per ticket id). Returns false when another caller already revealed it.
 */
async function revealAndSettle(ticket) {
  const claimed = await prisma.scratchTicket.updateMany({
    where: { id: ticket.id, isRevealed: false },
    data: { isRevealed: true, revealedAt: new Date() }
  });
  if (claimed.count !== 1) return false;
  await settleBet(ticket.userId, ticket.price, ticket.payout, 'scratch', ticket.id);
  return true;
}

// Tickets bought but never scratched are settled automatically so winnings are never stranded.
let sweeperStarted = false;
function startSweeper() {
  if (sweeperStarted || process.env.NODE_ENV === 'test') return;
  sweeperStarted = true;
  setInterval(async () => {
    try {
      const stale = await prisma.scratchTicket.findMany({
        where: { isRevealed: false, purchasedAt: { lt: new Date(Date.now() - AUTO_SETTLE_AFTER_MS) } },
        take: 200
      });
      for (const ticket of stale) await revealAndSettle(ticket).catch((err) => console.error('[Scratch] auto-settle failed', ticket.id, err.message));
    } catch (err) {
      console.error('[Scratch] sweeper error', err.message);
    }
  }, 60 * 1000).unref();
}

function handleScratchSockets(socket, io) {
  startSweeper();

  socket.on('scratch:buy', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const tierId = data.tierId;
      const tier = Object.prototype.hasOwnProperty.call(TIERS, tierId) ? TIERS[tierId] : null;
      if (!tier) throw new GameError('INVALID_BET', 'Invalid ticket tier.');

      const pricePaise = BigInt(tier.price * 100);
      const ticketData = engine.generateTicket(tierId);

      const { ticket, newBalance } = await prisma.$transaction(async (tx) => {
        const created = await tx.scratchTicket.create({
          data: {
            userId,
            tier: tierId,
            price: pricePaise,
            payout: BigInt(Math.round(ticketData.payout * 100)),
            grid: ticketData.grid,
            isRevealed: false,
            serverSeed: ticketData.serverSeed,
            clientSeed: ticketData.clientSeed,
            nonce: ticketData.nonce
          }
        });
        const balance = await debitStake(tx, userId, pricePaise, 'scratch', created.id);
        return { ticket: created, newBalance: balance };
      });

      if (typeof callback === 'function') {
        // The grid is sent so the card can be drawn; the prize is only credited on reveal.
        callback({ success: true, data: { ticketId: ticket.id, grid: ticketData.grid, payout: ticketData.payout, newBalance: Number(newBalance) } });
      }
    } catch (err) {
      replyError(callback, err, 'Scratch buy');
    }
  });

  socket.on('scratch:reveal', async (data = {}, callback) => {
    try {
      const userId = requirePlayer(socket);
      const ticket = typeof data.ticketId === 'string'
        ? await prisma.scratchTicket.findUnique({ where: { id: data.ticketId } })
        : null;
      if (!ticket || ticket.userId !== userId) throw new GameError('NOT_FOUND', 'Ticket not found.');
      if (!(await revealAndSettle(ticket))) throw new GameError('ALREADY_REVEALED', 'Ticket already revealed.');

      const wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
      if (typeof callback === 'function') {
        callback({ success: true, data: { payout: Number(ticket.payout) / 100, newBalance: Number(wallet.balance) } });
      }
    } catch (err) {
      replyError(callback, err, 'Scratch reveal');
    }
  });
}

module.exports = { handleScratchSockets, revealAndSettle };
