const { PokerTable, TABLE_STATE } = require('poker-engine');

// In-memory store for tables (in production this would be backed by Redis)
const tables = {};

function getOrCreateTable(tableId) {
  if (!tables[tableId]) {
    const table = new PokerTable(tableId, 6, 10, 20);
    // Pre-seed realistic AI players so poker table is immediately interactive and thrilling
    table.addPlayer({ id: 'bot_aria', name: 'Aria [AI]', balance: 10000, chips: 10000 }, 1);
    table.addPlayer({ id: 'bot_vikram', name: 'Vikram [VIP]', balance: 25000, chips: 25000 }, 2);
    table.addPlayer({ id: 'bot_rahul', name: 'Rahul [Pro]', balance: 15000, chips: 15000 }, 4);
    tables[tableId] = table;
  }
  return tables[tableId];
}

function initPokerSockets(io, socket) {
  socket.on('poker_join', (data) => {
    const tableId = data?.tableId || 'high-roller-1';
    const requestedSeat = typeof data?.seatIndex === 'number' ? data.seatIndex : 0;
    
    const table = getOrCreateTable(tableId);
    const userId = data?.userId || socket.user?.id || `usr_${socket.id.slice(0, 6)}`;
    const userName = data?.userName || socket.user?.name || 'Player';

    try {
      // Check if user is already seated
      let userSeat = table.seats.findIndex(s => s && s.id === userId);
      
      if (userSeat === -1) {
        let targetSeat = requestedSeat;
        if (table.seats[targetSeat] !== null) {
          targetSeat = table.seats.findIndex(s => s === null);
        }
        if (targetSeat !== -1) {
          table.addPlayer({
            id: userId,
            name: userName,
            balance: 10000,
            chips: 10000
          }, targetSeat);
        }
      }

      socket.join(`poker:${tableId}`);
      console.log(`[Poker] ${userId} joined table ${tableId}`);

      // Auto-start hand if waiting
      if (table.state === TABLE_STATE.WAITING && table.players.length >= 2) {
        table.startHand();
        table.pot = 30; // Small blind (10) + big blind (20)
        
        // Immediately deal Flop to wow user with action cards on table
        table.dealFlop();
      }

      io.to(`poker:${tableId}`).emit('poker_state', table);
    } catch (err) {
      console.error(`[Poker Join Error]`, err.message);
      socket.emit('poker_state', table);
    }
  });

  socket.on('poker_action', (data) => {
    const tableId = data?.tableId || 'high-roller-1';
    const action = data?.action || 'check';
    const amount = Number(data?.amount || 0);
    const table = tables[tableId];
    if (!table) return;

    const userId = socket.user?.id || data?.userId || `usr_${socket.id.slice(0, 6)}`;
    
    // Process action & chips
    if (action === 'raise' && amount > 0) {
      table.pot += amount;
    } else if (action === 'check') {
      table.pot += 10;
    }

    io.to(`poker:${tableId}`).emit('poker_action_update', { userId, action, amount });

    // Progress table state through street progression: FLOP -> TURN -> RIVER -> SHOWDOWN
    if (table.state === TABLE_STATE.FLOP && table.communityCards.length < 4) {
      table.dealTurn();
    } else if (table.state === TABLE_STATE.TURN && table.communityCards.length < 5) {
      table.dealRiver();
    } else if (table.state === TABLE_STATE.RIVER) {
      const result = table.showdown();
      io.to(`poker:${tableId}`).emit('poker_showdown', result);
      
      // Auto-restart next hand after 3.5 seconds
      setTimeout(() => {
        if (tables[tableId]) {
          tables[tableId].startHand();
          tables[tableId].pot = 30;
          tables[tableId].dealFlop();
          io.to(`poker:${tableId}`).emit('poker_state', tables[tableId]);
        }
      }, 3500);
    }

    io.to(`poker:${tableId}`).emit('poker_state', table);
  });
}

module.exports = { initPokerSockets };
