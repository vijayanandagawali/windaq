const { PrismaClient } = require('@prisma/client');
const { ScratchEngine, TIERS } = require('../services/scratchEngine');
const { ensureUserAndWallet } = require('../services/walletService');

const prisma = new PrismaClient();
const engine = new ScratchEngine();

function handleScratchSockets(socket, io) {
  
  socket.on('scratch:buy', async (data, callback) => {
    const resolvedUserId = (socket.user?.id && socket.user.id !== 'guest') ? socket.user.id : (process.env.NODE_ENV === 'test' && data?.userId ? data.userId : null);
    if (!resolvedUserId) {
      return callback({ success: false, code: 'AUTH_REQUIRED', message: 'You must be logged in to buy scratch cards.' });
    }
    const userId = resolvedUserId;
    const { tierId } = data;
    const tier = TIERS[tierId];
    
    if (!tier) return callback({ success: false, message: 'Invalid ticket tier.' });

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Fetch wallet, auto-provision guest for testing if needed
        let { wallet } = await ensureUserAndWallet(tx, userId);
        
        const pricePaise = BigInt(tier.price * 100);

        if (wallet.balance < pricePaise) {
          throw new Error('Insufficient balance in wallet.');
        }

        // 1. Deduct ticket price
        const newBalance = wallet.balance - pricePaise;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

        // 2. Generate secure ticket
        const ticketData = engine.generateTicket(tierId);
        
        // 3. Record Immutable Ticket
        const ticket = await tx.scratchTicket.create({
          data: {
            userId,
            tier: tierId,
            price: pricePaise,
            payout: BigInt(ticketData.payout * 100),
            grid: ticketData.grid,
            isRevealed: false,
            serverSeed: ticketData.serverSeed,
            clientSeed: ticketData.clientSeed,
            nonce: ticketData.nonce
          }
        });

        // 4. Record Financial Transaction for Buy
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `scratch-buy-${ticket.id}`,
            type: 'BET_PLACE',
            amount: pricePaise,
            balanceAfter: newBalance,
            reference: ticket.id
          }
        });

        return {
          ticketId: ticket.id,
          grid: ticketData.grid,
          payout: ticketData.payout, // Send payout to client so it knows what to animate, but it's not credited yet
          newBalance: newBalance.toString()
        };
      });

      callback({ success: true, data: result });
      
    } catch (e) {
      console.error('Scratch buy error', e);
      callback({ success: false, message: e.message });
    }
  });

  socket.on('scratch:reveal', async (data, callback) => {
    const { ticketId, userId } = data;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const ticket = await tx.scratchTicket.findUnique({ where: { id: ticketId } });
        if (!ticket) throw new Error("Ticket not found.");
        if (ticket.userId !== userId) throw new Error("Unauthorized.");
        if (ticket.isRevealed) throw new Error("Ticket already revealed.");

        // Mark as revealed
        await tx.scratchTicket.update({
          where: { id: ticketId },
          data: { isRevealed: true, revealedAt: new Date() }
        });

        let { wallet } = await ensureUserAndWallet(tx, userId);
        let newBalance = wallet.balance;

        // Credit winnings if any
        if (ticket.payout > 0n) {
          newBalance = wallet.balance + ticket.payout;
          await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              idempotencyKey: `scratch-win-${ticket.id}`,
              type: 'BET_WIN',
              amount: ticket.payout,
              balanceAfter: newBalance,
              reference: ticket.id
            }
          });
        }

        return {
          payout: Number(ticket.payout) / 100,
          newBalance: newBalance.toString()
        };
      });

      callback({ success: true, data: result });

    } catch (e) {
      console.error('Scratch reveal error', e);
      callback({ success: false, message: e.message });
    }
  });
}

module.exports = { handleScratchSockets };
