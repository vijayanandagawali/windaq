function handleTeenPattiSockets(socket, io, engines) {
  const tpRoom = engines.tpRoom; // We will instantiate this in server.js

  socket.on('tp:join', (data, callback) => {
    try {
      const userId = data?.userId || socket.user?.id || `guest-${socket.id.substring(0,4)}`;
      const user = { id: userId, name: data?.userName || userId };
      socket.join(`tp:${tpRoom.roomId}`);
      tpRoom.join(user, socket.id);
      if (callback) callback({ success: true, userId });
    } catch (e) {
      if (callback) callback({ success: false, message: e.message });
    }
  });

  socket.on('tp:leave', (data) => {
    const userId = data?.userId || socket.user?.id || `guest-${socket.id.substring(0,4)}`;
    tpRoom.leave(userId);
    socket.leave(`tp:${tpRoom.roomId}`);
  });

  socket.on('tp:action', (data, callback) => {
    const { action } = data; // 'see', 'pack', 'chaal', 'show'
    const userId = data?.userId || socket.user?.id || `guest-${socket.id.substring(0,4)}`;

    try {
      if (action === 'see') {
        tpRoom.seeCards(userId);
      } else if (action === 'pack') {
        tpRoom.pack(userId);
      } else if (action === 'chaal') {
        tpRoom.chaal(userId, false);
      } else if (action === 'show') {
        tpRoom.chaal(userId, true);
      }
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ success: false, message: e.message });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const userId = socket.user?.id || `guest-${socket.id.substring(0,4)}`;
    if (tpRoom) {
      tpRoom.leave(userId);
    }
  });
}

module.exports = { handleTeenPattiSockets };
