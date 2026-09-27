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
  return getGameSocket(WS_BASE_URL, {
    transports: ['websocket', 'polling'],
    ...options,
    // Called on every (re)connect, so an expired ticket is replaced automatically.
    auth: (cb: (data: Record<string, unknown>) => void) => {
      fetchSocketTicket().then((ticket) => cb({ ...(options.auth || {}), ...(ticket ? { token: ticket } : {}) }));
    }
  });
}
