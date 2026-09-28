/**
 * WinDaq game socket factory.
 *
 * Every game talks only to the authoritative realtime server. There is no in-browser fallback:
 * when the server cannot be reached the UI shows an explicit "game server offline" banner and
 * no bets can be placed.
 */
import { io as realIo, Socket } from 'socket.io-client';
import { useDemoModeStore } from '@/store/demoModeStore';

export function getGameSocket(url?: string, options?: any): Socket {
  const s = realIo(url || '', {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    ...options
  });
  // Surface connection health so the UI can show an explicit "server offline" state
  // instead of an endless "waiting for next round".
  let failures = 0;
  s.on('connect', () => {
    failures = 0;
    useDemoModeStore.getState().setServerOffline(false);
  });
  s.on('connect_error', () => {
    failures += 1;
    if (failures >= 2) useDemoModeStore.getState().setServerOffline(true);
  });
  return s;
}

export const io = getGameSocket;
export type { Socket };
