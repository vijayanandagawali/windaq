const { authenticateSocketTicket } = require('../services/sessionService');
const riskService = require('../services/riskService');
const { handleColourSockets } = require('./colourHandler');
const { handleSlotSockets } = require('./slotHandler');
const { handleScratchSockets } = require('./scratchHandler');
const { handleLottoSockets } = require('./lottoHandler');
const { handleDiceSockets } = require('./diceHandler');
const { handleTableSockets } = require('./tableHandler');
const { handleRouletteSockets } = require('./rouletteHandler');
const { handleBlackjackSockets } = require('./blackjackHandler');
const { handleHoldemSockets } = require('./holdemHandler');
const { handleRummyPracticeSockets } = require('./rummyPracticeHandler');
const { handleLudoPracticeSockets } = require('./ludoPracticeHandler');
const { handleUniversalSockets } = require('./universalHandler');
const CoreSocketManager = require('./CoreSocketManager');
const { installRoomGuard, isAllowedClientRoom } = require('./roomGuard');
const { installHandlerGuard } = require('./handlerGuard');

// Store active connections per user to enforce limits
const activeUserConnections = new Map();
// Each tab opens a wallet socket plus a game socket, so allow a few tabs per player.
const MAX_CONNECTIONS_PER_USER = 10;

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
        console.warn(`[Socket] Connection limit reached for user ${effectiveUserId}`);
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
    // A malformed client event (missing ack, bad payload) must never crash the process.
    installHandlerGuard(socket);
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
    handleColourSockets(socket, io, engines.colourEngines);
    handleSlotSockets(socket, io);
    handleScratchSockets(socket, io);
    handleLottoSockets(socket, io, engines);
    handleDiceSockets(socket, io, engines);
    handleTableSockets(socket, io, engines);
    handleRouletteSockets(socket, io, engines);
    handleBlackjackSockets(socket, io, engines.blackjackEngine);
    handleHoldemSockets(socket);
    handleRummyPracticeSockets(socket);
    handleLudoPracticeSockets(socket);
    // Multiplayer card tables (Teen Patti, Hold'em, Rummy) are not offered for real money until
    // real matchmaking exists: the previous tables seated house bots against players.
    for (const event of ['tp:join', 'tp:action', 'poker_join', 'poker_action', 'rm:join', 'rm:draw', 'rm:discard', 'rm:declare', 'rm:drop']) {
      socket.on(event, (data, callback) => callback({ success: false, code: 'COMING_SOON', message: 'This table is coming soon.' }));
    }
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
