import { getApiUrl } from '@/lib/config';

export type Role = 'WK' | 'BAT' | 'AR' | 'BOWL';
export interface FPlayer { id: string; name: string; team: 'A' | 'B'; role: Role; credits: number; inLineup: boolean; points: number | null }
export interface FContest { id: string; name: string; entryFee: number; maxEntries: number; maxTeamsPerUser: number; prizeText: string | null; joined: number }
export interface FMatch {
  id: string; title: string; teamA: string; teamB: string; teamAShort: string; teamBShort: string;
  format: string; venue: string | null; startsAt: string; status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'ABANDONED'; open: boolean;
  players?: FPlayer[]; contests?: FContest[];
}
export interface FTeam { id: string; name: string; playerIds: string[]; captainId: string; viceCaptainId: string; points: number; entries: { contestId: string; rank: number | null; points: number }[] }

export const ROLE_INFO: Record<Role, { label: string; short: string; min: number; max: number }> = {
  WK: { label: 'Wicket-keepers', short: 'WK', min: 1, max: 4 },
  BAT: { label: 'Batters', short: 'BAT', min: 3, max: 6 },
  AR: { label: 'All-rounders', short: 'AR', min: 1, max: 4 },
  BOWL: { label: 'Bowlers', short: 'BOWL', min: 3, max: 6 }
};
export const MAX_CREDITS = 100;
export const MAX_PER_SIDE = 7;

/** A stable colour per team short name (no club logos: neutral monograms only). */
const PALETTE = ['#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#0F766E'];
export function teamColor(short: string) {
  let h = 0;
  for (const ch of short) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export async function fantasyApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: boolean; data?: T; message?: string; code?: string; status: number }> {
  try {
    const res = await fetch(getApiUrl(`/api/fantasy${path}`), {
      method: init?.method || 'GET',
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store'
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.success, data: json.data, message: json.message, code: json.code, status: res.status };
  } catch {
    return { ok: false, message: 'Network error. Please try again.', status: 0 };
  }
}

/** "2h 14m" / "3d 4h" countdown to a start time, or null once it has passed. */
export function countdown(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const hh = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${hh}h`;
  if (hh > 0) return `${hh}h ${mm}m`;
  const ss = Math.floor((ms % 60000) / 1000);
  return `${mm}m ${String(ss).padStart(2, '0')}s`;
}
