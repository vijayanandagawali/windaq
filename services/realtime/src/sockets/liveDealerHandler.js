const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function handleLiveDealerSockets(socket, io, liveRouletteEngine) {
  
  // --- PLAYER EVENTS ---
  
  socket.on('live:join', async (data, callback) => {
    try {
      const { tableId } = data;
      socket.join(`live_${tableId}`);
      
      const round = await prisma.liveRound.findFirst({
        where: { tableId, status: { not: 'CANCELLED' } },
        orderBy: { startTime: 'desc' },
        include: { dealer: true }
      });
      
      if (typeof callback === 'function') {
        callback({ success: true, state: round });
      }
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });

  socket.on('live:bet', async (data, callback) => {
    try {
      const { tableId, market, targets, amount, userId } = data;
      const res = await liveRouletteEngine.placeBet(userId, tableId, market, targets, amount);
      if (typeof callback === 'function') callback({ success: true, data: res });
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });


  // --- DEALER CONSOLE EVENTS ---
  
  socket.on('dealer:login', async (data, callback) => {
    try {
      const { pinCode } = data;
      const dealer = await prisma.liveDealer.findUnique({ where: { pinCode } });
      
      if (!dealer || !dealer.isActive) throw new Error("Invalid or inactive dealer PIN");
      
      if (typeof callback === 'function') callback({ success: true, dealer });
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });

  socket.on('dealer:open_betting', async (data, callback) => {
    try {
      const { tableId, dealerId } = data;
      const round = await liveRouletteEngine.openBetting(tableId, dealerId);
      if (typeof callback === 'function') callback({ success: true, round });
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });

  socket.on('dealer:close_betting', async (data, callback) => {
    try {
      const { tableId } = data;
      const round = await liveRouletteEngine.closeBetting(tableId);
      if (typeof callback === 'function') callback({ success: true, round });
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });

  socket.on('dealer:submit_result', async (data, callback) => {
    try {
      const { tableId, result } = data;
      const round = await liveRouletteEngine.submitResult(tableId, result.number);
      if (typeof callback === 'function') callback({ success: true, round });
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });

  socket.on('dealer:settle_round', async (data, callback) => {
    try {
      const { tableId } = data;
      const round = await liveRouletteEngine.settleRound(tableId);
      if (typeof callback === 'function') callback({ success: true, round });
    } catch (e) {
      if (typeof callback === 'function') callback({ success: false, message: e.message });
    }
  });
}

module.exports = { handleLiveDealerSockets };
