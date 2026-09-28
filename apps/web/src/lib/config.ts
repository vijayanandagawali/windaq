/**
 * Centralized Configuration for WinDaq Frontend.
 */
import { getGameSocket } from './gameSocket';
import type { Socket } from 'socket.io-client';

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}`
    : 'http://localhost:4000');

/**
 * All browser API calls go to this site's own /api proxy (same origin, locally and in production).
 * The proxy attaches the httpOnly session cookie, so page code never handles tokens.
 */
export function getApiUrl(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

/**
 * Fetches a short-lived socket ticket for the signed-in session (empty when signed out).
 */
async function fetchSocketTicket(): Promise<string | null> {
  try {
    const res = await fetch(getApiUrl('/api/auth/socket-ticket'), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.ticket === 'string' ? data.ticket : null;
  } catch {
    return null;
  }
}

export function createGameSocket(path = '', options: any = {}): Socket {
  const socket = getGameSocket(WS_BASE_URL, {
    transports: ['websocket', 'polling'],
    ...options,
    // Called on every (re)connect, so an expired ticket is replaced automatically.
    auth: (cb: (data: Record<string, unknown>) => void) => {
      fetchSocketTicket().then((ticket) => cb({ ...(options.auth || {}), ...(ticket ? { token: ticket } : {}) }));
    }
  });

  // Any game action the server refuses with AUTH_REQUIRED opens the sign-in sheet, so a visitor
  // who taps "bet" is guided to log in instead of seeing a bare error.
  const rawEmit = socket.emit.bind(socket);
  socket.emit = ((event: string, ...args: unknown[]) => {
    const last = args[args.length - 1];
    if (typeof last === 'function') {
      args[args.length - 1] = (res: { code?: string } | undefined) => {
        if (res?.code === 'AUTH_REQUIRED') {
          import('@/store/authStore').then((m) => m.useAuthStore.getState().openAuthModal('LOGIN'));
        }
        (last as (r: unknown) => void)(res);
      };
    }
    return rawEmit(event, ...args);
  }) as typeof socket.emit;

  return socket;
}
