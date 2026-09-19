const jwt = require('jsonwebtoken');

/**
 * High-performance WebSocket Engine Initialization
 */
function initSockets(io) {
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
      next();
    } catch (err) {
      next(new Error('Authentication Error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} [${socket.user.id}]`);

    // Handle joining game rooms (Multiplexing)
    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`Client ${socket.id} joined room: ${room}`);
      
      // If joining Aviator, we could send them the last known multiplier instantly from Redis
    });

    socket.on('leave_room', (room) => {
      socket.leave(room);
    });

    // Handle incoming bets for Aviator
    socket.on('place_bet', async (data) => {
      if (socket.user.id === 'guest') {
        socket.emit('error', 'Must be logged in to place bets.');
        return;
      }
      // Handled by Aviator Handler in full production...
      console.log(`Bet placed by ${socket.user.id} for amount ${data.amount}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSockets };
