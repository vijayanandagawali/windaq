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
const { handleUniversalSockets } = require('./universalHandler');
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
    const token = socket.handshake.auth?.token;
    if (!token) {
      // Allow unauthenticated visitor connections for viewing / spectating only
      socket.user = { id: 'guest', userId: 'guest', role: 'viewer', isGuest: true };
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-fallback');
      const effectiveUserId = decoded.userId || decoded.id;
      
      socket.user = {
        id: effectiveUserId,
        userId: effectiveUserId,
        phone: decoded.phone,
        role: decoded.role,
        isGuest: Boolean(decoded.isGuest)
      };
      
      // Enforce Connection Limits per User
      const userConns = activeUserConnections.get(effectiveUserId) || 0;
      if (userConns >= MAX_CONNECTIONS_PER_USER) {
        return next(new Error('Connection Limit Exceeded'));
      }
      activeUserConnections.set(effectiveUserId, userConns + 1);
      
      // Track Device and IP for Anti-Abuse
      const ip = socket.handshake.address || socket.request?.connection?.remoteAddress || '127.0.0.1';
      const ua = socket.request?.headers?.['user-agent'] || 'unknown';
      riskService.trackDevice(effectiveUserId, ip, ua);

      next();
    } catch (err) {
      // Fallback to spectator if token expired/invalid
      socket.user = { id: 'guest', userId: 'guest', role: 'viewer', isGuest: true };
      next();
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.user?.userId || socket.user?.id;
    console.log(`🔌 Client connected: ${socket.id} [${uid || 'guest'}]`);
    coreManager.registerSocket(socket);

    if (uid && uid !== 'guest') {
      socket.join(`user:${uid}`);
    }

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
    handleUniversalSockets(socket, io, engines);

    // Real Prisma-backed Aviator Bet & Settlement Engine
    const { PrismaClient } = require('@prisma/client');
    const { ensureUserAndWallet } = require('../services/walletService');
    const prisma = new PrismaClient();

    socket.on('place_bet', async (data, callback) => {
      const userId = (socket.user?.id && !socket.user.isGuest) ? socket.user.id : null;
      if (!userId) {
        const errPayload = { success: false, code: 'AUTH_REQUIRED', message: 'Authentication required to place bets' };
        if (callback) callback(errPayload);
        socket.emit('bet_error', errPayload);
        return socket.emit('error', errPayload);
      }

      // Check account restriction
      const risk = await prisma.userRiskProfile.findUnique({ where: { userId } }).catch(() => null);
      if (risk && risk.isSuspended) {
        const errPayload = { success: false, code: 'ACCOUNT_RESTRICTED', message: 'Account is restricted: Betting suspended.' };
        if (callback) callback(errPayload);
        socket.emit('bet_error', errPayload);
        return socket.emit('error', errPayload);
      }

      const amount = Number(data?.amount || 100);
      const amountPaise = BigInt(Math.round(amount * 100));

      try {
        let wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
        if (!wallet) {
          const ensured = await ensureUserAndWallet(prisma, userId);
          wallet = ensured.wallet;
        }
        if (!wallet || wallet.balance < amountPaise) {
          if (callback) callback({ success: false, code: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance in wallet.' });
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
      const userId = (socket.user?.id && socket.user.id !== 'guest') ? socket.user.id : (process.env.NODE_ENV === 'test' && data?.userId ? data.userId : null);
      if (!userId || userId === 'guest') return;

      const winAmount = Number(data?.winAmount || (data?.amount * data?.multiplier));
      const winPaise = BigInt(Math.floor(winAmount * 100));

      try {
        let wallet = await prisma.wallet.findFirst({ where: { userId, currency: 'INR' } });
        if (!wallet) {
          const ensured = await ensureUserAndWallet(prisma, userId);
          wallet = ensured.wallet;
        }
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
