/**
 * Centralized Configuration for WinDaq Frontend.
 * Reads environment variables with production-ready fallbacks for Vercel deployment.
 */
import { getGameSocket } from './gameSocket';
import type { Socket } from 'socket.io-client';

export const API_BASE_URL = 
  typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' && process.env.NEXT_PUBLIC_API_URL?.includes('localhost')
        ? (process.env.NEXT_PUBLIC_API_URL || '')
        : '')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

export const WS_BASE_URL = 
  process.env.NEXT_PUBLIC_WS_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `${window.location.origin}`
    : 'http://localhost:4000');

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  // In any browser environment on a live domain, always use relative path so requests hit the same host!
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return cleanEndpoint;
  }
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
}

export function createGameSocket(path = '', options: any = {}): Socket {
  let token: string | null = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('windaq_auth_token');
  }
  return getGameSocket(WS_BASE_URL, {
    transports: ['websocket', 'polling'],
    auth: { token, ...(options.auth || {}) },
    ...options
  });
}

