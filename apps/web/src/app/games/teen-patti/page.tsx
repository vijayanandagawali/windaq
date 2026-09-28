"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Info, ShieldCheck } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { useBetSettlements, type SettlementSummary } from '@/hooks/useBetSettlements';
import { audioEngine } from '@/lib/audioEngine';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import TeenPattiHand, { type TpCard } from '@/components/games/TeenPattiHand';

const GAME = 'teen-patti-2020';
const ROOM = 'Auto';
const CHIP_VALUES = [10, 50, 100, 500, 1000];

interface TpResult {
  playerA: TpCard[];
  playerB: TpCard[];
  handA: { category: string; label: string };
  handB: { category: string; label: string };
  winner: 'A' | 'B' | 'TIE';
}

const PAIR_PLUS_TABLE = [
  ['Pure Sequence', '40 : 1'],
  ['Trail', '30 : 1'],
  ['Sequence', '6 : 1'],
  ['Color', '4 : 1'],
  ['Pair', '1 : 1']
];

function BetButton({ title, sub, tone, stake, won, disabled, onClick }: {
  title: string; sub: string; tone: 'sky' | 'rose' | 'amber'; stake?: number; won: boolean; disabled: boolean; onClick: () => void;
}) {
  const toneClass = tone === 'sky'
    ? 'from-sky-500 to-sky-600 text-white shadow-[0_10px_24px_rgba(14,165,233,0.35)]'
    : tone === 'rose'
      ? 'from-rose-500 to-rose-600 text-white shadow-[0_10px_24px_rgba(244,63,94,0.3)]'
      : 'from-amber-50 to-amber-100 text-amber-900 ring-1 ring-amber-200';
  return (
    <button onClick={onClick} disabled={disabled}
      className={`relative flex flex-col items-center rounded-2xl bg-gradient-to-b px-2 py-3.5 transition disabled:opacity-60 ${toneClass} ${won ? 'ring-4 ring-amber-300' : ''}`}>
      <span className="text-base font-black uppercase tracking-wider sm:text-lg">{title}</span>
      <span className="text-[11px] font-bold opacity-80">{sub}</span>
      {stake ? <span className="absolute -top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-amber-950 shadow">₹{stake}</span> : null}
    </button>
  );
}

export default function TeenPattiPage() {
  const { fetchBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<string>('WAITING');
  const [lockTime, setLockTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [seedHash, setSeedHash] = useState<string>('');
  const [result, setResult] = useState<TpResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [chip, setChip] = useState(10);
  const [myBets, setMyBets] = useState<Record<string, number>>({});
  const [showRules, setShowRules] = useState(false);

  // Reveal choreography: cards land face down (A, B, A, B, A, B), then turn one at a time.
  const [dealt, setDealt] = useState({ A: 0, B: 0 });
  const [shown, setShown] = useState({ A: 0, B: 0 });
  const [revealed, setRevealed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const dealtRoundRef = useRef<string | null>(null);
  const resultRef = useRef<TpResult | null>(null);
  const revealedWinnerRef = useRef<string | null>(null);
  const pendingSummaryRef = useRef<SettlementSummary | null>(null);

  const [celebration, setCelebration] = useState<{ status: 'IDLE' | 'WON' | 'LOST'; amount: number; multiplier?: number; message?: string; net?: number }>({ status: 'IDLE', amount: 0 });

  const winnerText = (r: TpResult) => (r.winner === 'TIE' ? `Tie · ${r.handA.label}` : `Player ${r.winner} · ${(r.winner === 'A' ? r.handA : r.handB).label}`);

  const showOutcome = (summary: SettlementSummary, r: TpResult) => {
    pendingSummaryRef.current = null;
    if (summary.paid > 0) {
      audioEngine.play('win');
      setCelebration({ status: 'WON', amount: summary.paid, multiplier: summary.bestMultiplier, net: summary.paid - summary.staked, message: winnerText(r) });
    } else if (summary.staked > 0) {
      audioEngine.play('loss');
      setCelebration({ status: 'LOST', amount: summary.staked, message: `${winnerText(r)} · Bet lost` });
    }
    fetchBalance();
  };

  useBetSettlements(socket, 'teen_patti_2020', (summary) => {
    const r = resultRef.current;
    if (r && revealedWinnerRef.current) showOutcome(summary, r);
    else pendingSummaryRef.current = summary;
  });

  const reveal = (r: TpResult) => {
    clearTimers();
    setDealt({ A: 0, B: 0 });
    setShown({ A: 0, B: 0 });
    setRevealed(false);
    const DEAL_MS = 280;
    for (let i = 0; i < 6; i++) {
      timers.current.push(setTimeout(() => {
        audioEngine.play('cardSlide');
        const side = i % 2 === 0 ? 'A' : 'B';
        setDealt((d) => ({ ...d, [side]: d[side as 'A' | 'B'] + 1 }));
      }, 300 + i * DEAL_MS));
    }
    // Even pace for every flip: nothing in the timing hints at the winner.
    const FLIP_MS = 650;
    const flipStart = 300 + 6 * DEAL_MS + 450;
    for (let i = 0; i < 6; i++) {
      timers.current.push(setTimeout(() => {
        audioEngine.play('cardFlip');
        const side = i % 2 === 0 ? 'A' : 'B';
        setShown((s) => ({ ...s, [side]: s[side as 'A' | 'B'] + 1 }));
      }, flipStart + i * FLIP_MS));
    }
    timers.current.push(setTimeout(() => {
      setRevealed(true);
      revealedWinnerRef.current = r.winner;
      if (pendingSummaryRef.current) showOutcome(pendingSummaryRef.current, r);
    }, flipStart + 6 * FLIP_MS + 250));
  };

  useEffect(() => {
    const s = createGameSocket();

    s.on('connect', () => {
      setSocket(s);
      s.emit('tg:join', { gameId: GAME, room: ROOM });
      s.emit('tg:history', { gameId: GAME, room: ROOM }, (res: { success: boolean; data?: { result?: { winner?: string } }[] }) => {
        if (res?.success && res.data) setHistory(res.data.map((h) => h.result?.winner || '?').filter((w) => w !== '?'));
      });
    });

    s.on('tg:tick', (data: { status?: string; lockTime?: number; serverSeedHash?: string }) => {
      if (data.status) setStatus(data.status);
      if (data.lockTime) setLockTime(data.lockTime);
      if (data.serverSeedHash) setSeedHash(data.serverSeedHash);
      if (data.status === 'OPEN' && resultRef.current) {
        clearTimers();
        resultRef.current = null;
        revealedWinnerRef.current = null;
        pendingSummaryRef.current = null;
        setResult(null);
        setMyBets({});
        setDealt({ A: 0, B: 0 });
        setShown({ A: 0, B: 0 });
        setRevealed(false);
        setCelebration({ status: 'IDLE', amount: 0 });
      }
    });

    s.on('tg:locked', () => {
      audioEngine.play('roundStart');
      setStatus('LOCKED');
    });

    s.on('tg:result', (data: { roundId?: string; result?: TpResult }) => {
      const r = data.result;
      if (!r?.playerA) return;
      const key = data.roundId || JSON.stringify(r.playerA);
      if (dealtRoundRef.current === key) return;
      dealtRoundRef.current = key;
      resultRef.current = r;
      setResult(r);
      setStatus('RESULT');
      setHistory((h) => [r.winner, ...h].slice(0, 30));
      reveal(r);
    });

    return () => {
      clearTimers();
      s.emit('tg:leave', { gameId: GAME, room: ROOM });
      s.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'OPEN') return;
    const tick = () => setTimeLeft(Math.max(0, Math.floor((lockTime - Date.now()) / 1000)));
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [status, lockTime]);

  const placeBet = (market: string, label: string) => {
    if (status !== 'OPEN') {
      toast.error('Betting is closed for this round.');
      return;
    }
    if (!socket) return;
    audioEngine.play('chipDrop');
    socket.emit('tg:bet', { gameId: GAME, room: ROOM, market, amount: chip }, (res: { success: boolean; message?: string }) => {
      if (res?.success) {
        setMyBets((b) => ({ ...b, [market]: (b[market] || 0) + chip }));
        toast.success(`₹${chip} on ${label}`);
        fetchBalance();
      } else {
        toast.error(res?.message || 'Bet not accepted');
      }
    });
  };

  const isOpen = status === 'OPEN';
  const dealing = !!result && !revealed;

  return (
    <div className="relative flex min-h-[calc(100dvh-58px)] w-full flex-col bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-3 pt-3 sm:px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight sm:text-xl">Teen Patti 20-20</h1>
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ShieldCheck size={12} className="text-emerald-600" /> Simulated dealer · provably fair shuffle</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow ring-1 ring-slate-200">
            <span className={`h-2 w-2 rounded-full ${isOpen ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-xs font-black uppercase tracking-wider">
              {isOpen ? 'Place bets' : dealing ? 'Dealing' : status === 'LOCKED' ? 'Bets closed' : 'Next round'}
            </span>
            {isOpen && <span className={`font-mono text-sm font-black ${timeLeft <= 5 ? 'text-rose-600' : 'text-emerald-600'}`}>{String(timeLeft).padStart(2, '0')}s</span>}
          </div>
        </div>

        {/* Felt */}
        <div className="mt-3 rounded-[28px] bg-[radial-gradient(circle_at_50%_10%,#22C3A6,#0B6B5C_85%)] p-3 shadow-[inset_0_10px_28px_rgba(0,0,0,0.28),0_18px_40px_rgba(11,107,92,0.25)] ring-4 ring-amber-200/70 sm:p-5">
          <div className="flex gap-2.5 sm:gap-5">
            <TeenPattiHand side="A" cards={result?.playerA || []} dealt={dealt.A} shown={shown.A}
              label={revealed && result ? result.handA.label : null} isWinner={revealed && result?.winner === 'A'} isTie={revealed && result?.winner === 'TIE'} />
            <div className="flex items-center"><span className="rounded-full bg-black/25 px-2 py-1 text-[10px] font-black text-white/80">VS</span></div>
            <TeenPattiHand side="B" cards={result?.playerB || []} dealt={dealt.B} shown={shown.B}
              label={revealed && result ? result.handB.label : null} isWinner={revealed && result?.winner === 'B'} isTie={revealed && result?.winner === 'TIE'} />
          </div>
          <div className="mt-2 h-7 text-center">
            <AnimatePresence>
              {revealed && result && (
                <motion.span key="w" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="inline-block rounded-full bg-amber-400 px-4 py-1 text-sm font-black uppercase text-amber-950 shadow-[0_0_24px_rgba(245,158,11,0.6)]">
                  {result.winner === 'TIE' ? 'Tie · main bets returned' : `Player ${result.winner} wins`}
                </motion.span>
              )}
              {!result && isOpen && <span className="text-xs font-semibold text-white/80">Cards are dealt when betting closes</span>}
            </AnimatePresence>
          </div>
        </div>

        {/* Bets */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {([
            ['PLAYER_A', 'Player A', 'Pays 1.98x', 'sky'],
            ['PLAYER_B', 'Player B', 'Pays 1.98x', 'rose'],
            ['PAIR_PLUS_A', 'Pair+ A', 'Pair or better · up to 41x', 'amber'],
            ['PAIR_PLUS_B', 'Pair+ B', 'Pair or better · up to 41x', 'amber']
          ] as const).map(([market, title, sub, tone]) => (
            <BetButton key={market} title={title} sub={sub} tone={tone} stake={myBets[market]} disabled={!isOpen}
              won={revealed && !!result && ((market === 'PLAYER_A' && result.winner === 'A') || (market === 'PLAYER_B' && result.winner === 'B'))}
              onClick={() => placeBet(market, title)} />
          ))}
        </div>

        <button onClick={() => setShowRules((v) => !v)} className="mx-auto mt-3 flex items-center gap-1 text-xs font-bold text-slate-500">
          <Info size={13} /> {showRules ? 'Hide rules & payouts' : 'Rules & payouts'}
        </button>
        {showRules && (
          <div className="mt-2 space-y-2 rounded-2xl bg-white p-4 text-xs text-slate-600 ring-1 ring-slate-200">
            <p>Each round two hands are dealt from one shuffled 52-card deck, one card at a time to Player A and Player B. Bet on the hand that wins. If both hands are exactly equal, bets on A and B are returned.</p>
            <p>Hand order: Trail › Pure Sequence › Sequence › Color › Pair › High Card. A-K-Q is the top sequence, A-2-3 the next.</p>
            <table className="w-full">
              <tbody>
                {PAIR_PLUS_TABLE.map(([hand, pay]) => (
                  <tr key={hand} className="border-t border-slate-100"><td className="py-1">Pair+ · {hand}</td><td className="py-1 text-right font-bold text-slate-900">{pay}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="break-all font-mono text-[10px] text-slate-400">Round seed hash: {seedHash || '—'}</p>
          </div>
        )}

        {/* History */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          {history.map((w, i) => (
            <span key={i} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white ${w === 'A' ? 'bg-sky-500' : w === 'B' ? 'bg-rose-500' : 'bg-slate-400'}`}>
              {w === 'TIE' ? 'T' : w}
            </span>
          ))}
        </div>
      </div>

      {/* Chips */}
      <div className="sticky bottom-0 z-30 mt-3 border-t border-slate-200 bg-white/85 p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md justify-center gap-3">
          {CHIP_VALUES.map((v) => (
            <button key={v} onClick={() => setChip(v)}
              className={`relative flex h-12 w-12 items-center justify-center rounded-full border-4 text-sm font-black transition ${chip === v ? '-translate-y-1.5 border-amber-400 bg-amber-50 text-amber-700 shadow-lg' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>
              {v >= 1000 ? `${v / 1000}k` : v}
            </button>
          ))}
        </div>
      </div>

      <WinLossCelebration status={celebration.status} net={celebration.net} amount={celebration.amount}
        multiplier={celebration.multiplier} message={celebration.message} onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })} />
    </div>
  );
}
