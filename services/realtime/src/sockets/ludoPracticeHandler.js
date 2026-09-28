const ludo = require('../services/ludo/ludoPractice');
const { replyError } = require('../services/gameBets');

/** Free Ludo practice against the Computer; signed-out visitors can play (game tied to the socket). */
function handleLudoPracticeSockets(socket) {
  const owner = () => (socket.user?.userId && socket.user.userId !== 'guest' ? `u:${socket.user.userId}` : `s:${socket.id}`);
  const reply = (cb, fn, label) => {
    try {
      const out = fn();
      if (typeof cb === 'function') cb({ success: true, ...out });
    } catch (err) {
      replyError(cb, err, label);
    }
  };
  socket.on('lp:start', (data = {}, cb) => reply(cb, () => ({ game: ludo.toPublic(ludo.start(owner(), { opponents: data.opponents, fresh: !!data.fresh })) }), 'Ludo start'));
  socket.on('lp:roll', (data = {}, cb) => reply(cb, () => {
    const { game, events } = ludo.roll(owner(), data.gameId);
    return { game: ludo.toPublic(game), events };
  }, 'Ludo roll'));
  socket.on('lp:move', (data = {}, cb) => reply(cb, () => {
    const { game, events } = ludo.move(owner(), data.gameId, data.token);
    return { game: ludo.toPublic(game), events };
  }, 'Ludo move'));
}

module.exports = { handleLudoPracticeSockets };
