const { PokerTable, TABLE_STATE } = require('poker-engine');

// In-memory store for tables (in production this would be backed by Redis)
const tables = {};

function initPokerSockets(io, socket) {
  socket.on('poker_join', (data) => {
    const { tableId, seatIndex } = data;
    
    if (!tables[tableId]) {
      tables[tableId] = new PokerTable(tableId);
    }
    
    const table = tables[tableId];
    try {
      table.addPlayer({
        id: socket.user.id,
        name: socket.user.name || 'Player'
      }, seatIndex);
      
      socket.join(`poker:${tableId}`);
      io.to(`poker:${tableId}`).emit('poker_state', table);
      console.log(`[Poker] ${socket.user.id} joined table ${tableId} at seat ${seatIndex}`);
      
      // Auto-start hand if enough players
      if (table.state === TABLE_STATE.WAITING && table.players.length >= 2) {
        setTimeout(() => {
          table.startHand();
          io.to(`poker:${tableId}`).emit('poker_state', table);
        }, 2000);
      }
    } catch (err) {
      socket.emit('error', err.message);
    }
  });

  socket.on('poker_action', (data) => {
    // Handling bets, folds, etc.
    const { tableId, action, amount } = data;
    const table = tables[tableId];
    if (!table) return;

    // Simplified action processing
    io.to(`poker:${tableId}`).emit('poker_action_update', { userId: socket.user.id, action, amount });
    
    // Evaluate if state should progress (simplified for now)
  });
}

module.exports = { initPokerSockets };
