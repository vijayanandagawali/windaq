function handleUniversalSockets(socket, io, engines = {}) {
  
  socket.on('round:join', (data) => {
    const { gameId, room = 'Standard', userId = socket.user?.id || 'guest' } = data || {};
    if (!gameId) return;

    const roomName = `${gameId}:${room}`;
    socket.join(roomName);
    console.log(`Client ${socket.id} joined universal room: ${roomName} (user: ${userId})`);

    // Look up engine
    const engineKey = `${gameId.replace('-', '')}Engine`;
    const engine = engines[engineKey] || engines[gameId];

    if (engine && typeof engine.getSnapshot === 'function') {
      const snapshot = engine.getSnapshot(userId);
      socket.emit('round:snapshot', snapshot);
      socket.emit('round:tick', snapshot);
    }
  });

  socket.on('round:leave', (data) => {
    const { gameId, room = 'Standard' } = data || {};
    if (gameId) {
      socket.leave(`${gameId}:${room}`);
    }
  });
}

module.exports = { handleUniversalSockets };
