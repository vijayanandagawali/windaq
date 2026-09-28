"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Info, ShieldCheck } from 'lucide-react';
import { useWalletStore } from '@/store/walletStore';
import { Socket } from '@/lib/gameSocket';
import { createGameSocket } from '@/lib/config';
import { audioEngine } from '@/lib/audioEngine';
import WinLossCelebration from '@/components/games/WinLossCelebration';
import { PlayingCard, type Suit } from '@/components/lobby/previews/primitives';

type Card = { suit: Suit; rank: number } | { hidden: true };

interface HandView {
  id: string;
  status: 'DECIDING' | 'CALLING' | 'FOLDED' | 'SETTLED';
  ante: number;
  call: number;
  playerCards: Card[];
  board: Card[];
  dealerCards: Card[];
  playerHand: string;
  result: null | {
    outcome: 'PLAYER_WINS' | 'DEALER_WINS' | 'PUSH' | 'DEALER_NOT_QUALIFIED' | 'FOLDED' | 'TIMED_OUT';
    dealerQualifies?: boolean;
    player?: { label: string };
    dealer?: { label: string };
  };
  payout: number;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  decideBy: string | null;
}

const ANTES = [10, 50, 100, 500, 1000];
const RANK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const PAYTABLE: [string, string][] = [
  ['Royal Flush', '100 : 1'],
  ['Straight Flush', '20 : 1'],
  ['Four of a Kind', '10 : 1'],
  ['Full House', '3 : 1'],
  ['Flush', '2 : 1'],
  ['Straight or lower', '1 : 1']
];
const OUTCOME_TEXT: Record<string, string> = {
  PLAYER_WINS: 'You win',
  DEALER_WINS: 'Dealer wins',
  PUSH: 'Split — bets returned',
  DEALER_NOT_QUALIFIED: 'Dealer does not qualify',
  FOLDED: 'You folded',
  TIMED_OUT: 'Hand timed out'
};

function CardSlot({ card, faceDown, className = '' }: { card?: Card; faceDown?: boolean; className?: string }) {
  if (!card) return <div className={`aspect-[5/7] rounded-[9%] border-2 border-dashed border-white/25 ${className}`} />;
  const hidden = 'hidden' in card;
  return (
    <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 18 }} className={className}>
      <PlayingCard rank={hidden ? 'A' : RANK[card.rank] || String(card.rank)} suit={hidden ? 'S' : card.suit} faceDown={hidden || faceDown} className="w-full" />
    </motion.div>
  );
}

export default function CasinoHoldemPage() {
  const { fetchBalance, holdLiveBalance } = useWalletStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hand, setHand] = useState<HandView | null>(null);
  const [ante, setAnte] = useState(10);
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // After a call: the turn, river and dealer cards are turned one by one before the result shows.
  const [revealStep, setRevealStep] = useState(3);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [celebration, setCelebration] = useState<{ status: 'IDLE' | 'WON' | 'LOST'; amount: number; message?: string; net?: number }>({ status: 'IDLE', amount: 0 });

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    const s = createGameSocket();
    s.on('connect', () => {
      setSocket(s);
      s.emit('holdem:state', {}, (res: { success: boolean; hand?: HandView | null }) => {
        if (res?.success && res.hand) { setHand(res.hand); setRevealStep(3); }
      });
    });
    return () => { clearTimers(); s.disconnect(); };
  }, []);

  const finish = (h: HandView) => {
    const staked = h.ante + h.call;
    const net = h.payout - staked;
    if (h.payout > 0 && net >= 0) {
      audioEngine.play(net > 0 ? 'win' : 'roundEnd');
      setCelebration({ status: 'WON', amount: h.payout, net, message: `${OUTCOME_TEXT[h.result?.outcome || '']} · ${h.result?.player?.label || ''}` });
    } else {
      audioEngine.play('loss');
      setCelebration({ status: 'LOST', amount: staked - h.payout, message: `${OUTCOME_TEXT[h.result?.outcome || '']}${h.result?.dealer?.label ? ` · Dealer: ${h.result.dealer.label}` : ''}` });
    }
    holdLiveBalance(0);
    fetchBalance();
  };

  const deal = () => {
    if (!socket || busy) return;
    setBusy(true);
    clearTimers();
    setCelebration({ status: 'IDLE', amount: 0 });
    socket.emit('holdem:deal', { ante }, (res: { success: boolean; hand?: HandView; message?: string }) => {
      setBusy(false);
      if (!res?.success || !res.hand) { toast.error(res?.message || 'Could not deal'); return; }
      audioEngine.play('chipDrop');
      setHand(res.hand);
      setRevealStep(3);
      [0, 1, 2, 3, 4].forEach((i) => timers.current.push(setTimeout(() => audioEngine.play('cardSlide'), 150 + i * 160)));
      fetchBalance();
    });
  };

  const decide = (action: 'CALL' | 'FOLD') => {
    if (!socket || !hand || busy) return;
    setBusy(true);
    // The call settles on the server at once; keep the header balance still until the cards are turned.
    if (action === 'CALL') holdLiveBalance(6000);
    socket.emit('holdem:decide', { handId: hand.id, action }, (res: { success: boolean; hand?: HandView; message?: string }) => {
      setBusy(false);
      if (!res?.success || !res.hand) { holdLiveBalance(0); toast.error(res?.message || 'Action failed'); return; }
      const h = res.hand;
      setHand(h);
      if (action === 'FOLD') { setRevealStep(3); audioEngine.play('cardSlide'); finish(h); return; }
      audioEngine.play('chipDrop');
      // Turn, river, then both dealer cards, at an even pace.
      setRevealStep(3);
      [4, 5, 6, 7].forEach((step, i) => timers.current.push(setTimeout(() => { audioEngine.play('cardFlip'); setRevealStep(step); }, 500 + i * 700)));
      timers.current.push(setTimeout(() => finish(h), 500 + 4 * 700 + 300));
    });
  };

  const deciding = hand?.status === 'DECIDING';
  const settled = hand && hand.status !== 'DECIDING';
  const revealing = hand?.status === 'SETTLED' && revealStep < 7;
  const boardShown = hand ? (hand.status === 'SETTLED' ? Math.min(5, Math.max(3, revealStep)) : 3) : 0;
  const dealerShown = hand?.status === 'FOLDED' || (hand?.status === 'SETTLED' && revealStep >= 7);

  return (
    <div className="relative flex min-h-[calc(100dvh-58px)] w-full flex-col bg-gradient-to-b from-sky-50 via-white to-emerald-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 pt-3 sm:px-4">
        <div>
          <h1 className="text-lg font-black tracking-tight sm:text-xl">Casino Hold&apos;em</h1>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><ShieldCheck size={12} className="text-emerald-600" /> You vs the dealer · provably fair deck</p>
        </div>

        {/* Felt */}
        <div className="mt-3 space-y-3 rounded-[28px] bg-[radial-gradient(circle_at_50%_10%,#22C3A6,#0B6B5C_85%)] p-4 shadow-[inset_0_10px_28px_rgba(0,0,0,0.28),0_18px_40px_rgba(11,107,92,0.25)] ring-4 ring-amber-200/70">
          <div className="flex flex-col items-center">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/80">Dealer</span>
            <div className="mt-1.5 flex gap-1.5 text-[20px]">
              {[0, 1].map((i) => <CardSlot key={i} card={hand?.dealerCards[i]} faceDown={!dealerShown} className="w-[52px]" />)}
            </div>
            <div className="h-6 pt-1">
              {dealerShown && hand?.result?.dealer && (
                <span className="rounded-full bg-black/25 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {hand.result.dealer.label}{hand.result.dealerQualifies === false ? ' · does not qualify' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-1.5 text-[20px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <CardSlot key={i} card={hand ? (i < boardShown ? hand.board[i] : hand.status === 'DECIDING' || i >= boardShown ? { hidden: true } : undefined) : undefined}
                className="w-[52px] min-[400px]:w-[58px]" />
            ))}
          </div>

          <div className="flex flex-col items-center">
            <div className="flex gap-1.5 text-[24px]">
              {[0, 1].map((i) => <CardSlot key={i} card={hand?.playerCards[i]} className="w-[62px]" />)}
            </div>
            <div className="mt-1.5 h-6">
              {hand && (
                <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-[11px] font-black text-amber-950">
                  You: {hand.status === 'SETTLED' && !revealing && hand.result?.player ? hand.result.player.label : hand.playerHand}
                </span>
              )}
            </div>
          </div>

          <div className="h-7 text-center">
            <AnimatePresence>
              {settled && !revealing && hand?.result && (
                <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="inline-block rounded-full bg-white px-4 py-1 text-sm font-black uppercase text-emerald-700 shadow">
                  {OUTCOME_TEXT[hand.result.outcome]}{hand.payout > 0 ? ` · ₹${hand.payout.toLocaleString('en-IN')}` : ''}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4">
          {deciding && hand ? (
            <div className="space-y-2">
              <p className="text-center text-xs text-slate-500">Call to see the turn, river and the dealer&apos;s cards. Calling is right with most hands; fold only the weakest.</p>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => decide('FOLD')} disabled={busy} className="rounded-2xl bg-white py-4 text-sm font-black text-rose-600 ring-1 ring-rose-200 disabled:opacity-50">Fold</button>
                <button onClick={() => decide('CALL')} disabled={busy}
                  className="col-span-2 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-4 text-base font-black text-white shadow-[0_10px_24px_rgba(5,150,105,0.35)] disabled:opacity-50">
                  Call ₹{(hand.ante * 2).toLocaleString('en-IN')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center gap-2.5">
                {ANTES.map((v) => (
                  <button key={v} onClick={() => setAnte(v)} disabled={revealing}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border-4 text-sm font-black transition ${ante === v ? '-translate-y-1 border-amber-400 bg-amber-50 text-amber-700 shadow-lg' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
              <button onClick={deal} disabled={busy || revealing}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-emerald-500 py-4 text-base font-black text-white shadow-[0_10px_24px_rgba(14,165,233,0.3)] disabled:opacity-50">
                {hand ? 'Deal again' : 'Deal'} · ₹{ante.toLocaleString('en-IN')} ante
              </button>
              <p className="text-center text-[11px] text-slate-500">A call costs 2× the ante (₹{(ante * 2).toLocaleString('en-IN')}), so keep ₹{(ante * 3).toLocaleString('en-IN')} to play the hand fully.</p>
            </div>
          )}
        </div>

        <button onClick={() => setShowRules((v) => !v)} className="mx-auto mt-3 flex items-center gap-1 text-xs font-bold text-slate-500">
          <Info size={13} /> {showRules ? 'Hide rules & payouts' : 'Rules & payouts'}
        </button>
        {showRules && (
          <div className="mb-4 mt-2 space-y-2 rounded-2xl bg-white p-4 text-xs text-slate-600 ring-1 ring-slate-200">
            <p>You and the dealer each get two cards; five community cards are shared. After the flop, fold (lose the ante) or call with 2× the ante. The dealer needs a pair of 4s or better to qualify.</p>
            <p>Dealer doesn&apos;t qualify: your ante is paid by the table below and the call is returned. Dealer qualifies: beat the dealer and the ante is paid by the table and the call pays 1:1; a split returns both; otherwise both are lost.</p>
            <table className="w-full"><tbody>
              {PAYTABLE.map(([name, pay]) => (
                <tr key={name} className="border-t border-slate-100"><td className="py-1">Ante · {name}</td><td className="py-1 text-right font-bold text-slate-900">{pay}</td></tr>
              ))}
            </tbody></table>
            {hand && (
              <div className="break-all font-mono text-[10px] text-slate-400">
                <p>Seed hash: {hand.serverSeedHash}</p>
                <p>Client seed: {hand.clientSeed}</p>
                <p>Server seed: {hand.serverSeed || 'revealed when the hand ends'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <WinLossCelebration status={celebration.status} net={celebration.net} amount={celebration.amount}
        message={celebration.message} onDismiss={() => setCelebration({ status: 'IDLE', amount: 0 })} />
    </div>
  );
}
