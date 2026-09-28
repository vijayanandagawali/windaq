/**
 * Wraps every event handler registered on a socket so that:
 * - a missing acknowledgement callback becomes a no-op instead of a TypeError, and
 * - synchronous throws and rejected promises are logged instead of becoming unhandled
 *   rejections (which terminate a Node.js process by default).
 */
const INTERNAL_EVENTS = new Set(['disconnect', 'disconnecting', 'error']);

function installHandlerGuard(socket) {
  const rawOn = socket.on.bind(socket);
  socket.on = (event, handler) => {
    if (INTERNAL_EVENTS.has(event) || typeof handler !== 'function') return rawOn(event, handler);
    return rawOn(event, (...args) => {
      // Handlers are written as (data, callback): guarantee a callable ack in that position.
      const expectedArgs = Math.max(handler.length, 2);
      while (args.length < expectedArgs) args.push(undefined);
      const ackIndex = expectedArgs - 1;
      if (typeof args[ackIndex] !== 'function') args[ackIndex] = () => {};
      try {
        const result = handler(...args);
        if (result && typeof result.catch === 'function') {
          result.catch((err) => console.error(`[Socket:${event}] handler error:`, err?.message));
        }
      } catch (err) {
        console.error(`[Socket:${event}] handler error:`, err?.message);
      }
    });
  };
}

module.exports = { installHandlerGuard };
