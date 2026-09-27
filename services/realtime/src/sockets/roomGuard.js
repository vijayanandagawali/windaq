/**
 * Socket room isolation.
 *
 * Private rooms (`user:<id>`, `admin:*`) carry wallet and operator data and may only be joined
 * by the server itself. Every client-driven join goes through `socket.join`, so we wrap it once
 * per connection and keep an unguarded reference for server-initiated joins.
 */

const RESERVED_PREFIXES = ['user:', 'admin:'];
const ROOM_NAME_PATTERN = /^[A-Za-z0-9:_\-.]{1,64}$/;

function isAllowedClientRoom(room) {
  if (typeof room !== 'string' || !ROOM_NAME_PATTERN.test(room)) return false;
  const lower = room.toLowerCase();
  return !RESERVED_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Installs the guard and returns the raw join function for trusted server-side use.
 */
function installRoomGuard(socket) {
  const rawJoin = socket.join.bind(socket);
  socket.join = (rooms) => {
    const list = Array.isArray(rooms) ? rooms : [rooms];
    const allowed = list.filter(isAllowedClientRoom);
    if (allowed.length !== list.length) {
      console.warn(`[RoomGuard] Blocked join to reserved/invalid room by socket ${socket.id}`);
    }
    return allowed.length ? rawJoin(allowed) : undefined;
  };
  return rawJoin;
}

module.exports = { installRoomGuard, isAllowedClientRoom };
