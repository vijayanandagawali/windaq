function handleRummySockets(socket, io, rummyRoom) {
  
  socket.on('rm:join', (data) => {
    socket.join(`rm:${rummyRoom.roomId}`);
    try {
      rummyRoom.join({ id: data.userId || 'guest' }, socket.id);
    } catch (e) {
      socket.emit('rm:error', { message: e.message });
    }
  });

  socket.on('rm:leave', (data) => {
    rummyRoom.leave(data.userId || 'guest');
    socket.leave(`rm:${rummyRoom.roomId}`);
  });

  socket.on('rm:draw', (data) => {
    rummyRoom.draw(data.userId, data.source); // source = 'OPEN' or 'CLOSED'
  });

  socket.on('rm:discard', (data) => {
    rummyRoom.discard(data.userId, data.card);
  });

  socket.on('rm:declare', (data) => {
    rummyRoom.declare(data.userId, data.melds);
  });

  socket.on('rm:drop', (data) => {
    rummyRoom.drop(data.userId);
  });
  
  // Clean up on disconnect
  socket.on('disconnect', () => {
    // If we knew the userId tied to this socket, we could call leave()
    // For now we rely on explicit leave or they just time out.
  });
}

module.exports = { handleRummySockets };
