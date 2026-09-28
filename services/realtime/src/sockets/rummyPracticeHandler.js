const practice = require('../services/rummyPractice');
const { replyError } = require('../services/gameBets');

/**
 * Free Rummy practice against the Computer. No money moves, so signed-out visitors can play too:
 * their game is tied to this socket connection.
 */
function handleRummyPracticeSockets(socket) {
  const owner = () => (socket.user?.userId && socket.user.userId !== 'guest' ? `u:${socket.user.userId}` : `s:${socket.id}`);
  const reply = (callback, fn, label) => {
    try {
      const out = fn();
      if (typeof callback === 'function') callback({ success: true, ...out });
    } catch (err) {
      replyError(callback, err, label);
    }
  };

  socket.on('rp:start', (data = {}, cb) => reply(cb, () => ({ game: practice.toPublic(data.fresh ? practice.restart(owner()) : practice.start(owner())) }), 'Rummy start'));
  socket.on('rp:draw', (data = {}, cb) => reply(cb, () => {
    const { game, card } = practice.draw(owner(), data.gameId, data.source === 'OPEN' ? 'OPEN' : 'CLOSED');
    return { game: practice.toPublic(game), card };
  }, 'Rummy draw'));
  socket.on('rp:discard', (data = {}, cb) => reply(cb, () => ({ game: practice.toPublic(practice.discard(owner(), data.gameId, data.cardId)) }), 'Rummy discard'));
  socket.on('rp:declare', (data = {}, cb) => reply(cb, () => ({ game: practice.toPublic(practice.declare(owner(), data.gameId, data.groups, data.finishId)) }), 'Rummy declare'));
  socket.on('rp:drop', (data = {}, cb) => reply(cb, () => ({ game: practice.toPublic(practice.drop(owner(), data.gameId)) }), 'Rummy drop'));
  socket.on('rp:suggest', (data = {}, cb) => reply(cb, () => practice.suggest(owner(), data.gameId), 'Rummy suggest'));
  socket.on('rp:check', (data = {}, cb) => reply(cb, () => practice.check(owner(), data.gameId, data.groups), 'Rummy check'));
}

module.exports = { handleRummyPracticeSockets };
