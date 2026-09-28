'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, RefreshCw } from 'lucide-react';
import { getApiUrl } from '@/lib/config';
import { useWalletStore } from '@/store/walletStore';

/** Game pages whose bets the server can list (keys match /api/ledger/game-history). */
export const HISTORY_GAME_NAMES: Record<string, string> = {
  dice: 'Sic Bo Dice',
  'color-prediction': 'Colour Prediction',
  'colour-prediction': 'Colour Prediction',
  lotto: 'Lotto 6/49',
  'european-roulette': 'European Roulette',
  blackjack: 'Blackjack',
  scratch: 'Scratch Cards',
  slots: 'Slots',
  aviator: 'Aviator',
  'andar-bahar': 'Andar Bahar',
  'dragon-tiger': 'Dragon Tiger',
  'teen-patti': 'Teen Patti 20-20',
  'texas-holdem': 'Casino Hold’em'
};

interface HistoryBet {
  id: string;
  market: string | null;
  stake: number;
  payout: number;
  net: number | null;
  status: 'WON' | 'LOST' | 'REFUNDED' | 'PENDING';
  placedAt: string;
}
interface HistoryData {
  bets: HistoryBet[];
  today: { bets: number; wins: number; staked: number; paid: number; net: number };
}

const inr = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n > 0 ? `+${inr(n)}` : n < 0 ? `−${inr(n)}` : inr(0));
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

function StatusChip({ bet }: { bet: HistoryBet }) {
  if (bet.status === 'PENDING') return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">In play</span>;
  if (bet.status === 'REFUNDED') return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Refunded</span>;
  if (bet.status === 'WON' && (bet.net ?? 0) > 0) return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Won</span>;
  if (bet.status === 'WON') return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Returned</span>;
  return <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">Lost</span>;
}

/**
 * "My bets" sheet for the current game: the player's recent bets and today's totals, read from the
 * server ledger so every number matches the wallet.
 */
export default function GameHistorySheet({ game, open, onClose }: { game: string; open: boolean; onClose: () => void }) {
  const balance = useWalletStore((s) => s.balance);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(getApiUrl(`/api/ledger/game-history?game=${encodeURIComponent(game)}&limit=30`), { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error('failed');
      setData(json.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [game]);

  // Reload on open and whenever the balance moves while open (a bet was placed or settled).
  useEffect(() => {
    if (!open) return;
    // Short delay: batches the several balance updates one settlement can produce.
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [open, load, balance]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const today = data?.today;

  // Portal to <body>: the sticky header's backdrop blur would otherwise trap `position: fixed`.
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="My bets">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.18)] sm:rounded-3xl">
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900"><History size={17} className="text-emerald-600" /> My bets</h2>
                <p className="text-xs font-semibold text-slate-500">{HISTORY_GAME_NAMES[game] || 'This game'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={load} aria-label="Refresh" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 active:scale-90">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 active:scale-90">
                  <X size={15} />
                </button>
              </div>
            </div>

            {today && (
              <div className="mx-4 grid grid-cols-3 gap-2 rounded-2xl bg-gradient-to-br from-sky-50 to-emerald-50 p-3 ring-1 ring-emerald-100">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Today</p>
                  <p className="text-sm font-extrabold text-slate-900">{today.bets} {today.bets === 1 ? 'bet' : 'bets'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Staked</p>
                  <p className="text-sm font-extrabold tabular-nums text-slate-900">{inr(today.staked)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net</p>
                  <p className={`text-sm font-extrabold tabular-nums ${today.net > 0 ? 'text-emerald-600' : today.net < 0 ? 'text-rose-600' : 'text-slate-700'}`}>{signed(today.net)}</p>
                </div>
              </div>
            )}

            <div className="mt-3 flex-1 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {error && <p className="py-8 text-center text-sm font-semibold text-rose-600">Could not load your bets. Tap refresh to try again.</p>}
              {!error && data && data.bets.length === 0 && (
                <p className="py-10 text-center text-sm font-semibold text-slate-500">No bets on this game yet.</p>
              )}
              {!error && !data && loading && <p className="py-10 text-center text-sm font-semibold text-slate-400">Loading…</p>}
              <ul className="divide-y divide-slate-100">
                {data?.bets.map((bet) => (
                  <li key={bet.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusChip bet={bet} />
                        {bet.market && <span className="truncate text-xs font-bold uppercase text-slate-700">{bet.market}</span>}
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-400">{time(bet.placedAt)} · stake {inr(bet.stake)}</p>
                    </div>
                    <span className={`shrink-0 text-sm font-extrabold tabular-nums ${bet.net === null ? 'text-amber-600' : bet.net > 0 ? 'text-emerald-600' : bet.net < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                      {bet.net === null ? '—' : signed(bet.net)}
                    </span>
                  </li>
                ))}
              </ul>
              {today && <p className="pb-2 pt-3 text-center text-[10px] font-medium text-slate-400">Today counts settled bets since midnight IST. Play within your limits.</p>}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
