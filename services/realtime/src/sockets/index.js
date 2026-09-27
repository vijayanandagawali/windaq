const { authenticateSocketTicket } = require('../services/sessionService');
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
const { installRoomGuard, isAllowedClientRoom } = require('./roomGuard');

// Store active connections per user to enforce limits
const activeUserConnections = new Map();
const MAX_CONNECTIONS_PER_USER = 3;

/**
 * High-performance WebSocket Engine Initialization
 */
function initSockets(coreManager, io, engines = {}) {
  // Authentication Middleware for Sockets
  // Only short-lived socket tickets (GET /api/auth/socket-ticket) are accepted; they must belong to
  // a still-active server-side session. Anything else connects as a read-only spectator.
  io.use(async (socket, next) => {
    const ticket = socket.handshake.auth?.token;
    if (!ticket) {
      // Allow unauthenticated visitor connections for viewing / spectating only
      socket.user = { id: 'guest', userId: 'guest', role: 'viewer', isGuest: true };
      return next();
    }

    try {
      const identity = await authenticateSocketTicket(ticket);
      const effectiveUserId = identity.userId;

      socket.user = identity;

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

    // All client-driven joins are filtered; only the server may join private rooms.
    const serverJoin = installRoomGuard(socket);
    if (uid && uid !== 'guest') {
      serverJoin(`user:${uid}`);
    }

    // Handle joining game rooms (Multiplexing)
    socket.on('join_room', (room, clientSeq) => {
      // Rate Limit Check
      if (!coreManager.checkRateLimit(socket.id)) {
        return socket.emit('error', 'Rate limit exceeded');
      }
      if (!isAllowedClientRoom(room)) {
        return socket.emit('error', 'Room not available');
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

    // Aviator betting — server-authoritative. The engine owns stake, multiplier and payout;
    // identity comes only from the verified socket session.
    const aviatorEngine = engines.aviatorEngine;
    const aviatorUserId = () => (socket.user?.userId && socket.user.userId !== 'guest' ? socket.user.userId : null);
    const replyAviatorError = (callback, err, eventName) => {
      const payload = { success: false, code: err.code || 'SERVER_ERROR', message: err.code ? err.message : 'Request failed. Please try again.' };
      if (!err.code) console.error(`[Aviator ${eventName} Error]`, err.message);
      if (typeof callback === 'function') callback(payload);
      socket.emit('bet_error', payload);
    };

    socket.on('place_bet', async (data, callback) => {
      const userId = aviatorUserId();
      if (!userId) return replyAviatorError(callback, { code: 'AUTH_REQUIRED', message: 'Authentication required to place bets' }, 'place_bet');
      if (!coreManager.checkRateLimit(socket.id)) return replyAviatorError(callback, { code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' }, 'place_bet');
      if (!aviatorEngine) return replyAviatorError(callback, { code: 'GAME_UNAVAILABLE', message: 'Aviator is not available right now.' }, 'place_bet');
      try {
        const result = await aviatorEngine.placeBet(userId, {
          amount: data?.amount,
          slot: data?.slot ?? 0,
          autoCashout: data?.autoCashout
        });
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (err) {
        replyAviatorError(callback, err, 'place_bet');
      }
    });

    socket.on('aviator:cashout', async (data, callback) => {
      const userId = aviatorUserId();
      if (!userId) return replyAviatorError(callback, { code: 'AUTH_REQUIRED', message: 'Authentication required' }, 'cashout');
      if (!aviatorEngine) return replyAviatorError(callback, { code: 'GAME_UNAVAILABLE', message: 'Aviator is not available right now.' }, 'cashout');
      try {
        // Only the slot is read from the client; amount/multiplier/winAmount are ignored.
        const result = await aviatorEngine.cashout(userId, { slot: data?.slot ?? 0 });
        if (typeof callback === 'function') callback({ success: true, ...result });
      } catch (err) {
        replyAviatorError(callback, err, 'cashout');
      }
    });

    socket.on('aviator:my_bets', (data, callback) => {
      const userId = aviatorUserId();
      if (typeof callback !== 'function') return;
      callback({ success: true, bets: userId && aviatorEngine ? aviatorEngine.getUserBets(userId) : [] });
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
