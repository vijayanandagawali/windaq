const jwt = require('jsonwebtoken');
const riskService = require('../services/riskService');
const { initPokerSockets } = require('./pokerHandler');
const { handleColourSockets } = require('./colourHandler');
const { handleSlotSockets } = require('./slotHandler');
const { handleScratchSockets } = require('./scratchHandler');
const { handleLottoSockets } = require('./lottoHandler');
const { handleTeenPattiSockets } = require('./teenPattiHandler');
const { handleDiceSockets } = require('./diceHandler');
const { handleTableSockets } = require('./tableHandler');
const { handleRouletteSockets } = require('./rouletteHandler');
const { handleBlackjackSockets } = require('./blackjackHandler');
const { handleRummySockets } = require('./rummyHandler');
const { handleLiveDealerSockets } = require('./liveDealerHandler');
const CoreSocketManager = require('./CoreSocketManager');

// Store active connections per user to enforce limits
const activeUserConnections = new Map();
const MAX_CONNECTIONS_PER_USER = 3;

/**
 * High-performance WebSocket Engine Initialization
 */
function initSockets(coreManager, io, engines = {}) {
  // Authentication Middleware for Sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      // Allow guest connections for viewing only, or enforce auth
      // For real-money games, we typically allow guests to spectate
      socket.user = { id: 'guest', role: 'viewer' };
      return next();
    }

    try {
      // In production, JWT_SECRET should be securely stored
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'windaq-super-secret');
      socket.user = decoded;
      
      // Enforce Connection Limits per User
      const userConns = activeUserConnections.get(decoded.id) || 0;
      if (userConns >= MAX_CONNECTIONS_PER_USER) {
        return next(new Error('Connection Limit Exceeded'));
      }
      activeUserConnections.set(decoded.id, userConns + 1);
      
      // Track Device and IP for Anti-Abuse
      const ip = socket.handshake.address || socket.request.connection.remoteAddress;
      const ua = socket.request.headers['user-agent'] || 'unknown';
      riskService.trackDevice(decoded.id, ip, ua);

      next();
    } catch (err) {
      next(new Error('Authentication Error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} [${socket.user.id}]`);
    coreManager.registerSocket(socket);

    // Handle joining game rooms (Multiplexing)
    socket.on('join_room', (room, clientSeq) => {
      // Rate Limit Check
      if (!coreManager.checkRateLimit(socket.id)) {
        return socket.emit('error', 'Rate limit exceeded');
      }

      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
      
      // Reconnect state reconciliation
      if (clientSeq !== undefined) {
         // Example hook for engines to attach snapshot fns.
         // coreManager.handleReconnect(socket, room, clientSeq, () => getSnapshot());
      }
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
    });

    // Initialize module-specific sockets
    initPokerSockets(io, socket);
    handleColourSockets(socket, io);
    handleSlotSockets(socket, io);
    handleScratchSockets(socket, io);
    handleLottoSockets(socket, io, engines);
    handleTeenPattiSockets(socket, io, engines);
    handleDiceSockets(socket, io, engines);
    handleTableSockets(socket, io, engines);
    handleRouletteSockets(socket, io, engines);
    handleBlackjackSockets(socket, io, engines.blackjackEngine);
    handleRummySockets(socket, io, engines.rummyRoom);
    handleLiveDealerSockets(socket, io, engines.liveRouletteEngine);

    // Real Prisma-backed Aviator Bet & Settlement Engine
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    socket.on('place_bet', async (data, callback) => {
      const userId = data.userId || (socket.user.id !== 'guest' ? socket.user.id : 'sbx-usr-normal-001');
      const amount = Number(data.amount || 100);
      const amountPaise = BigInt(amount * 100);

      try {
        const wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
        if (!wallet || wallet.balance < amountPaise) {
          if (callback) callback({ success: false, message: 'Insufficient balance in wallet.' });
          return socket.emit('error', 'Insufficient balance');
        }

        await prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: wallet.balance - amountPaise }
        });

        await prisma.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `aviator_bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: 'BET_PLACE',
            amount: amountPaise,
            balanceAfter: wallet.balance - amountPaise,
            reference: 'aviator_round'
          }
        });

        if (callback) callback({ success: true, newBalance: Number(wallet.balance - amountPaise) / 100 });
        console.log(`[Aviator] Bet placed by ${userId} for ₹${amount}`);
      } catch (err) {
        console.error('[Aviator Bet Error]', err);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    socket.on('aviator:cashout', async (data, callback) => {
      const userId = data.userId || (socket.user.id !== 'guest' ? socket.user.id : 'sbx-usr-normal-001');
      const winAmount = Number(data.winAmount || (data.amount * data.multiplier));
      const winPaise = BigInt(Math.floor(winAmount * 100));

      try {
        const wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
        if (wallet) {
          const newBal = wallet.balance + winPaise;
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBal }
          });

          await prisma.transaction.create({
            data: {
              walletId: wallet.id,
              idempotencyKey: `aviator_win_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              type: 'BET_WIN',
              amount: winPaise,
              balanceAfter: newBal,
              reference: `aviator_win_${data.multiplier || 1}x`
            }
          });

          if (callback) callback({ success: true, newBalance: Number(newBal) / 100 });
          console.log(`[Aviator] Cashout processed for ${userId}: ₹${winAmount}`);
        }
      } catch (err) {
        console.error('[Aviator Cashout Error]', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      if (socket.user && socket.user.id !== 'guest') {
        const count = activeUserConnections.get(socket.user.id);
        if (count > 1) {
          activeUserConnections.set(socket.user.id, count - 1);
        } else {
          activeUserConnections.delete(socket.user.id);
        }
      }
    });
  });
}

module.exports = { initSockets };
