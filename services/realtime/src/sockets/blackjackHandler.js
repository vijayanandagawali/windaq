const BlackjackEngine = require('../services/tableGames/BlackjackEngine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('../services/walletService');

const handleBlackjackSockets = (io, socket) => {
  
  socket.on('bj:join', async (data, callback) => {
    try {
      const userId = data?.userId || socket.user?.id || 'sbx-usr-normal-001';
      // Create a fresh game for the user or fetch existing if we supported resume
      const game = await BlackjackEngine.createGame(userId);
      socket.join(`bj_${game.id}`);
      
      if (typeof callback === 'function') {
        callback({ success: true, gameId: game.id, state: game });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on('bj:bet', async (data, callback) => {
    try {
      const userId = data?.userId || socket.user?.id || 'sbx-usr-normal-001';
      const betAmount = Number(data?.amount || 50);
      const betPaise = BigInt(Math.floor(betAmount * 100));

      const { wallet } = await walletService.ensureUserAndWallet(prisma, userId);
      if (wallet.balance < betPaise) {
        if (typeof callback === 'function') callback({ success: false, message: 'Insufficient balance.' });
        return;
      }

      const newBal = wallet.balance - betPaise;
      await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
      await prisma.transaction.create({
        data: {
          walletId: wallet.id,
          idempotencyKey: `bj_bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          type: 'BET_PLACE',
          amount: betPaise,
          balanceAfter: newBal,
          reference: `bj_${data.gameId}`
        }
      });

      const game = await BlackjackEngine.dealInitialCards(data.gameId, betAmount);
      
      if (typeof callback === 'function') {
        callback({ success: true, state: game, newBalance: Number(newBal) / 100 });
      }
      
      // If game settled immediately (Blackjack), emit event
      if (game.status === 'SETTLED') {
        io.to(`bj_${game.id}`).emit('bj:state', game);
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  socket.on('bj:action', async (data, callback) => {
    try {
      const { gameId, handId, actionType } = data;
      let game;
      
      if (actionType === 'HIT') {
        game = await BlackjackEngine.hit(gameId, handId);
      } else if (actionType === 'STAND') {
        game = await BlackjackEngine.stand(gameId, handId);
      } else {
        throw new Error("Unsupported action");
      }

      if (typeof callback === 'function') {
        callback({ success: true, state: game });
      }
      
      if (game.status === 'SETTLED') {
        io.to(`bj_${gameId}`).emit('bj:state', game);
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });
};

module.exports = { handleBlackjackSockets };
