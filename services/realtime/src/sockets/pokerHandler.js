const { PokerTable, TABLE_STATE } = require('poker-engine');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const walletService = require('../services/walletService');

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
  socket.on('poker_join', async (data) => {
    const tableId = data?.tableId || 'high-roller-1';
    const requestedSeat = typeof data?.seatIndex === 'number' ? data.seatIndex : 0;
    
    const table = getOrCreateTable(tableId);
    const userId = (socket.user?.id && socket.user.id !== 'guest') ? socket.user.id : (process.env.NODE_ENV === 'test' && data?.userId ? data.userId : 'guest');
    const userName = data?.userName || socket.user?.name || (userId === 'guest' ? 'Guest Player' : 'Player');

    try {
      // Ensure wallet exists in DB
      let userBalance = 10000;
      try {
        const { wallet } = await walletService.ensureUserAndWallet(prisma, userId);
        userBalance = Number(wallet.balance) / 100;
      } catch (wErr) {
        console.warn('[Poker] Using default balance for guest:', wErr.message);
      }

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
            balance: userBalance,
            chips: userBalance
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

  socket.on('poker_action', async (data) => {
    const tableId = data?.tableId || 'high-roller-1';
    const action = data?.action || 'check';
    const amount = Number(data?.amount || 0);
    const table = tables[tableId];
    if (!table) return;

    const userId = (socket.user?.id && socket.user.id !== 'guest') ? socket.user.id : (process.env.NODE_ENV === 'test' && data?.userId ? data.userId : null);
    if (!userId) return socket.emit('error', 'Authentication required to bet in poker');
    const betAmount = action === 'raise' && amount > 0 ? amount : (action === 'call' ? 20 : 0);

    // If real wager involved, deduct from wallet
    if (betAmount > 0) {
      try {
        const betPaise = BigInt(Math.floor(betAmount * 100));
        const { wallet } = await walletService.ensureUserAndWallet(prisma, userId);
        if (wallet.balance >= betPaise) {
          const newBal = wallet.balance - betPaise;
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBal }
          });
          await prisma.transaction.create({
            data: {
              walletId: wallet.id,
              idempotencyKey: `poker_bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'BET_PLACE',
              amount: betPaise,
              balanceAfter: newBal,
              reference: `poker_${tableId}_${action}`
            }
          });
          socket.emit('wallet_update', { balance: Number(newBal) / 100 });
        }
      } catch (err) {
        console.error('[Poker Bet Error]', err.message);
      }
    }
    
    // Process action & chips
    if (action === 'raise' && amount > 0) {
      table.pot += amount;
    } else if (action === 'check') {
      table.pot += 10;
    } else if (action === 'call') {
      table.pot += 20;
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
      
      // Settle pot to winner if real user
      const winnerId = result?.winner?.id || result?.winners?.[0]?.id;
      if (winnerId && !winnerId.startsWith('bot_')) {
        try {
          const winPaise = BigInt(Math.floor(table.pot * 100));
          const { wallet } = await walletService.ensureUserAndWallet(prisma, winnerId);
          const newBal = wallet.balance + winPaise;
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBal }
          });
          await prisma.transaction.create({
            data: {
              walletId: wallet.id,
              idempotencyKey: `poker_win_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'BET_WIN',
              amount: winPaise,
              balanceAfter: newBal,
              reference: `poker_${tableId}_pot`
            }
          });
          io.to(`poker:${tableId}`).emit('wallet_update', { userId: winnerId, balance: Number(newBal) / 100 });
        } catch (sErr) {
          console.error('[Poker Settlement Error]', sErr.message);
        }
      }

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
