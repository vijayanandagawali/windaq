'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PlayingCard, type Suit } from '@/components/lobby/previews/primitives';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import { audioEngine } from '@/lib/audioEngine';
import type { SettlementSummary } from '@/hooks/useBetSettlements';
import type { SimulatedLiveState } from './tableTypes';

type Market = 'DRAGON' | 'TIGER' | 'TIE';
const CHIPS = [10, 50, 100, 500, 1000, 5000];
const RANK_LABEL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const rankLabel = (r: number) => RANK_LABEL[r] || String(r);

const BETTING = new Set(['BETTING_OPEN', 'BETTING_CLOSING']);
const DEALT = new Set(['BETTING_LOCKED', 'BETTING_CLOSED', 'PLAYING', 'DEALING']);
const REVEAL = new Set(['RESULT', 'RESULT_REVEAL', 'SETTLEMENT', 'COMPLETED', 'NEXT_ROUND']);

/**
 * Dragon Tiger table. Cards are dealt face down once bets lock; on the server's result the
 * Dragon card turns first, then — after a beat — the Tiger card, and only then is the winner
 * shown. The outcome is always the server's; the pacing only builds anticipation.
 */
export default function DragonTigerTable({ state, balance, onPlaceBet, settlement }: {
  state: SimulatedLiveState;
  balance: number;
  onPlaceBet: (market: Market, amount: number) => Promise<boolean>;
  settlement?: (SettlementSummary & { id: number }) | null;
}) {
  const [chip, setChip] = useState(100);
  const [myBets, setMyBets] = useState<Record<Market, number>>({ DRAGON: 0, TIGER: 0, TIE: 0 });
  const [lastRoundBets, setLastRoundBets] = useState<Record<Market, number> | null>(null);
  const [revealStep, setRevealStep] = useState(0); // 0 none, 1 dragon shown, 2 tiger shown, 3 winner
  const [celebration, setCelebration] = useState<{ status: 'IDLE' | 'WON' | 'LOST'; amount: number; multiplier?: number; message?: string; net?: number }>({ status: 'IDLE', amount: 0 });
  const roundRef = useRef(state.roundId);

  const isBetting = BETTING.has(state.phase);
  const isDealt = DEALT.has(state.phase);
  const result = REVEAL.has(state.phase) ? state.result : null;

  // New round: archive bets for "repeat", reset the table.
  useEffect(() => {
    if (state.roundId && state.roundId !== roundRef.current) {
      roundRef.current = state.roundId;
      setMyBets((prev) => {
        if (prev.DRAGON + prev.TIGER + prev.TIE > 0) setLastRoundBets(prev);
        return { DRAGON: 0, TIGER: 0, TIE: 0 };
      });
      setRevealStep(0);
    }
  }, [state.roundId]);

  // Staged reveal when the result arrives.
  const resultKey = result ? `${state.roundId}:${result.winner}` : null;
  useEffect(() => {
    if (!resultKey) return;
    const timers = [
      setTimeout(() => { setRevealStep(1); audioEngine.play('cardFlip'); }, 150),
      setTimeout(() => { setRevealStep(2); audioEngine.play('cardFlip'); }, 1700),
      setTimeout(() => setRevealStep(3), 2500)
    ];
    return () => timers.forEach(clearTimeout);
  }, [resultKey]);

  // Server-settled outcome, shown after the winner is revealed.
  useEffect(() => {
    if (!settlement) return;
    const show = () => {
      if (settlement.paid > 0) {
        setCelebration({ status: 'WON', amount: settlement.paid, multiplier: settlement.bestMultiplier, net: settlement.paid - settlement.staked, message: state.result?.winner ? `${state.result.winner} wins` : undefined });
      } else if (settlement.staked > 0) {
        setCelebration({ status: 'LOST', amount: settlement.staked, message: state.result?.winner ? `${state.result.winner} won this round` : 'No win this round' });
      }
    };
    const t = setTimeout(show, revealStep >= 3 ? 0 : 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlement?.id]);

  const place = async (market: Market, amount = chip) => {
    if (!isBetting) { toast.error('Bets are closed for this round'); return; }
    if (amount > balance) { toast.error('Not enough balance'); return; }
    audioEngine.play('bet');
    const ok = await onPlaceBet(market, amount);
    if (ok) setMyBets((prev) => ({ ...prev, [market]: prev[market] + amount }));
  };

  const repeat = async () => {
    if (!lastRoundBets) return;
    for (const m of ['DRAGON', 'TIE', 'TIGER'] as Market[]) {
      if (lastRoundBets[m] > 0) await place(m, lastRoundBets[m]);
    }
  };

  const total = Math.max(1, state.totalPhaseDuration || 15);
  const progress = isBetting ? Math.max(0, Math.min(1, state.phaseTimeLeft / total)) : 0;
  const winner = revealStep >= 3 ? result?.winner : null;
  const statusText = isBetting ? 'Place your bets' : isDealt ? 'Cards dealt · bets closed' : result ? (winner ? `${winner === 'TIE' ? 'Tie' : `${winner[0]}${winner.slice(1).toLowerCase()} wins`}` : 'Revealing…') : 'Next round shortly';

  const slot = (side: 'DRAGON' | 'TIGER') => {
    const card = result?.[side === 'DRAGON' ? 'dragon' : 'tiger'] as { suit: Suit; rank: number } | undefined;
    const shown = card && revealStep >= (side === 'DRAGON' ? 1 : 2);
    const hasCard = isDealt || !!result;
    const won = winner === side;
    return (
      <div className={`relative flex flex-1 flex-col items-center rounded-2xl border-2 p-3 transition-all duration-500 ${won ? 'border-amber-300 bg-white/20 shadow-[0_0_40px_rgba(251,191,36,0.6)]' : 'border-white/25 bg-white/5'}`}>
        <span className={`text-xs font-black uppercase tracking-[0.2em] ${side === 'DRAGON' ? 'text-orange-200' : 'text-sky-200'}`}>{side === 'DRAGON' ? 'Dragon' : 'Tiger'}</span>
        <div className="mt-2 flex h-[122px] items-center justify-center text-[34px]">
          <AnimatePresence>
            {hasCard && (
              <motion.div initial={{ y: -80, opacity: 0, rotate: side === 'DRAGON' ? -12 : 12 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', damping: 16, stiffness: 180, delay: side === 'TIGER' ? 0.25 : 0 }}>
                <PlayingCard rank={card ? rankLabel(card.rank) : 'A'} suit={card?.suit || 'S'} faceDown={!shown} className="w-[84px]" />
              </motion.div>
            )}
          </AnimatePresence>
          {!hasCard && <div className="h-[118px] w-[84px] rounded-xl border-2 border-dashed border-white/30" />}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-6 pt-4">
      {/* Status */}
      <div className="mb-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <span className={`h-2.5 w-2.5 rounded-full ${isBetting ? 'bg-emerald-500 animate-pulse' : result ? 'bg-amber-400' : 'bg-rose-500'}`} />
            {statusText}
          </span>
          {isBetting && <span className="font-mono text-lg font-black tabular-nums text-emerald-600">{state.phaseTimeLeft}s</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-emerald-500 transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      {/* Felt table */}
      <div className="relative rounded-[28px] bg-[radial-gradient(circle_at_50%_15%,#22C3A6,#0B6B5C_85%)] p-3 shadow-[inset_0_10px_28px_rgba(0,0,0,0.28),0_18px_40px_rgba(11,107,92,0.25)] ring-4 ring-amber-200/70">
        <div className="flex items-stretch gap-3">
          {slot('DRAGON')}
          <div className="flex flex-col items-center justify-center">
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-amber-950 shadow">VS</span>
          </div>
          {slot('TIGER')}
        </div>
        <AnimatePresence>
          {winner && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 -bottom-4 flex justify-center">
              <span className={`rounded-full px-5 py-1.5 text-sm font-black uppercase tracking-wider text-white shadow-lg ${winner === 'DRAGON' ? 'bg-orange-500' : winner === 'TIGER' ? 'bg-sky-500' : 'bg-emerald-500'}`}>
                {winner === 'TIE' ? 'Tie' : `${winner} wins`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Road */}
      <div className="mt-6 flex items-center gap-2 overflow-x-auto rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200 [scrollbar-width:none]">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">Past</span>
        {state.history.slice(0, 24).map((h, i) => {
          const w = h.result?.winner;
          return (
            <span key={h.roundId || i} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${w === 'DRAGON' ? 'bg-orange-500' : w === 'TIGER' ? 'bg-sky-500' : 'bg-emerald-500'}`}>
              {w === 'DRAGON' ? 'D' : w === 'TIGER' ? 'T' : '='}
            </span>
          );
        })}
      </div>

      {/* Betting spots */}
      <div className="mt-4 grid grid-cols-[1fr_0.8fr_1fr] gap-2">
        {([
          ['DRAGON', 'Dragon', '1:1', 'from-orange-400 to-orange-600'],
          ['TIE', 'Tie', '11:1', 'from-emerald-400 to-emerald-600'],
          ['TIGER', 'Tiger', '1:1', 'from-sky-400 to-sky-600']
        ] as [Market, string, string, string][]).map(([m, label, odds, grad]) => (
          <button key={m} type="button" onClick={() => place(m)} disabled={!isBetting}
            className={`relative rounded-2xl bg-gradient-to-b ${grad} px-2 py-4 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] transition active:scale-95 disabled:opacity-50`}>
            <span className="block text-base font-black uppercase tracking-wide">{label}</span>
            <span className="block text-xs font-bold text-white/85">Pays {odds}</span>
            {myBets[m] > 0 && (
              <span className="absolute -top-2 right-2 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-black text-amber-950 shadow">₹{myBets[m]}</span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">On a tie, Dragon and Tiger bets return half the stake.</p>

      {/* Chips */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1 pt-2 [scrollbar-width:none]">
          {CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => setChip(c)}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-dashed text-xs font-black shadow transition ${chip === c ? '-translate-y-1.5 border-amber-300 bg-amber-400 text-amber-950 shadow-[0_8px_18px_rgba(245,158,11,0.45)]' : 'border-slate-300 bg-white text-slate-700'}`}>
              {c >= 1000 ? `${c / 1000}k` : c}
            </button>
          ))}
        </div>
        <button type="button" onClick={repeat} disabled={!lastRoundBets || !isBetting}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-40">
          <RotateCcw size={13} /> Repeat
        </button>
      </div>

      <WinLossCelebration status={celebration.status} amount={celebration.amount} multiplier={celebration.multiplier} message={celebration.message} net={celebration.net}
        onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })} />
    </div>
  );
}
