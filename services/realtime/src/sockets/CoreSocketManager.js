const metrics = require('../utils/MetricsService');
const riskService = require('../services/riskService');

class CoreSocketManager {
  constructor(io) {
    this.io = io;
    this.roomSequences = new Map(); // e.g., 'live_table_1': 45
    this.rateLimits = new Map(); // socketId -> { tokens, lastRefill }
    
    // Rate Limiting Config: 10 messages per second burst
    this.RATE_LIMIT_TOKENS = 10;
    this.RATE_LIMIT_REFILL_MS = 1000;
  }

  /**
   * Initializes rate limiting and connection handling for a socket.
   */
  registerSocket(socket) {
    this.rateLimits.set(socket.id, { tokens: this.RATE_LIMIT_TOKENS, lastRefill: Date.now() });

    socket.on('disconnect', () => {
      this.rateLimits.delete(socket.id);
    });
    
    // Custom Ping/Pong for latency tracking (Client sends "latency_ping" with its local timestamp)
    socket.on('latency_ping', (clientTs, callback) => {
      if (callback) callback({ serverTs: Date.now(), clientTs });
    });
  }

  /**
   * Checks if a socket is allowed to send a message based on Token Bucket.
   */
  checkRateLimit(socketId) {
    const limit = this.rateLimits.get(socketId);
    if (!limit) return false;

    const now = Date.now();
    const timePassed = now - limit.lastRefill;
    
    // Refill tokens
    if (timePassed > this.RATE_LIMIT_REFILL_MS) {
      limit.tokens = this.RATE_LIMIT_TOKENS;
      limit.lastRefill = now;
    }

    if (limit.tokens > 0) {
      limit.tokens--;
      return true;
    }

    // Rate limit exceeded
    limit.violations = (limit.violations || 0) + 1;
    if (limit.violations >= 5) {
       // Only flag once per burst limit memory
       limit.violations = 0; 
       riskService.flagUser(socketId, 'VELOCITY_ABUSE', { socketId, limit: this.RATE_LIMIT_TOKENS }, 'LOW');
    }

    return false; 
  }

  /**
   * Emits an event to a room with strict sequence versioning and server timestamp.
   */
  emitToRoom(room, eventName, payload) {
    let seq = this.roomSequences.get(room) || 0;
    seq++;
    this.roomSequences.set(room, seq);

    const enrichedPayload = {
      ...payload,
      _meta: {
        seq,
        ts: Date.now()
      }
    };

    // To track server delivery latency, we can use volatile emissions or rely on periodic pings.
    // For this implementation, we simply attach the timestamp. The client can calculate `Date.now() - payload._meta.ts` 
    // to measure delivery delay, and report it back to the server if needed.
    
    // For server processing latency, we measure time spent in the engine loop.
    
    this.io.to(room).emit(eventName, enrichedPayload);
  }

  /**
   * Handles a client reconnecting and requesting missed state.
   */
  handleReconnect(socket, room, clientSeq, engineSnapshotFn) {
    const currentSeq = this.roomSequences.get(room) || 0;
    
    if (clientSeq < currentSeq) {
      // Instead of replaying massive arrays of missed events, we send a FULL STATE SNAPSHOT.
      // This is far more resilient and memory efficient for casino games.
      const snapshot = engineSnapshotFn();
      socket.emit(`${room}:reconcile`, {
        type: 'FULL_SNAPSHOT',
        state: snapshot,
        _meta: { seq: currentSeq, ts: Date.now() }
      });
    }
  }
}

// Export as a singleton instance for global access
module.exports = CoreSocketManager;
