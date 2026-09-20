function handleTeenPattiSockets(socket, io, engines) {
  const tpRoom = engines.tpRoom; // We will instantiate this in server.js

  socket.on('tp:join', (data, callback) => {
    try {
      const user = socket.user || { id: `guest-${socket.id.substring(0,4)}` };
      socket.join(`tp:${tpRoom.roomId}`);
      tpRoom.join(user, socket.id);
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ success: false, message: e.message });
    }
  });

  socket.on('tp:leave', () => {
    const user = socket.user || { id: `guest-${socket.id.substring(0,4)}` };
    tpRoom.leave(user.id);
    socket.leave(`tp:${tpRoom.roomId}`);
  });

  socket.on('tp:action', (data, callback) => {
    const { action } = data; // 'see', 'pack', 'chaal', 'show'
    const user = socket.user || { id: `guest-${socket.id.substring(0,4)}` };

    try {
      if (action === 'see') {
        tpRoom.seeCards(user.id);
      } else if (action === 'pack') {
        tpRoom.pack(user.id);
      } else if (action === 'chaal') {
        tpRoom.chaal(user.id, false);
      } else if (action === 'show') {
        tpRoom.chaal(user.id, true);
      }
      if (callback) callback({ success: true });
    } catch (e) {
      if (callback) callback({ success: false, message: e.message });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = socket.user || { id: `guest-${socket.id.substring(0,4)}` };
    if (tpRoom) {
      tpRoom.leave(user.id);
    }
  });
}

module.exports = { handleTeenPattiSockets };
