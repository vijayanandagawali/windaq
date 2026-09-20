/**
 * Centralized Configuration for WinDaq Frontend.
 * Reads environment variables with production-ready fallbacks for Vercel deployment.
 */
import { io, Socket } from 'socket.io-client';

export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}`
    : 'http://localhost:4000');

export const WS_BASE_URL = 
  process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}`
    : 'http://localhost:4000');

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

export function createGameSocket(path = '', options = {}): Socket {
  return io(WS_BASE_URL, {
    transports: ['websocket', 'polling'],
    ...options
  });
}
