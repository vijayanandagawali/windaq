const BlackjackEngine = require('../services/tableGames/BlackjackEngine');

const handleBlackjackSockets = (io, socket) => {
  
  socket.on('bj:join', async (data, callback) => {
    try {
      // Create a fresh game for the user or fetch existing if we supported resume
      const game = await BlackjackEngine.createGame(data.userId);
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
      // 1. Deduct bet from wallet (Normally you call Wallet API here)
      // For now, we assume success
      const game = await BlackjackEngine.dealInitialCards(data.gameId, data.amount);
      
      if (typeof callback === 'function') {
        callback({ success: true, state: game });
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
